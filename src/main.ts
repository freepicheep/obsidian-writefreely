import { type App, MarkdownView, Notice, Plugin, type TFile } from "obsidian";
import { WriteFreelyStatusController } from "./status";
import { registerWriteFreelyCommands } from "./commands";
import { ConfirmModal, LoginModal } from "./ui";
import {
	DEFAULT_SETTINGS,
	WriteFreelySettingTab,
	type WriteFreelySettings,
} from "./settings";
import {
	getWriteFreelyMetadata,
	upsertWriteFreelyFrontmatter,
} from "./frontmatter";
import { WriteFreelyClient } from "./writefreely/client";
import type {
	NotePublishResult,
	WriteFreelyPost,
	WriteFreelyStatus,
} from "./types";

const ACCESS_TOKEN_KEY = "obsidian-writefreely-access-token";

interface SecretStorageCompat {
	getSecret(key: string): string | null;
	setSecret(key: string, value: string): void;
	deleteSecret?(key: string): void;
	removeSecret?(key: string): void;
}

export default class WriteFreelyPlugin extends Plugin {
	settings: WriteFreelySettings;
	readonly client = new WriteFreelyClient();
	private statusController: WriteFreelyStatusController | null = null;
	private settingTab: WriteFreelySettingTab | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.settingTab = new WriteFreelySettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		registerWriteFreelyCommands(this);

		this.statusController = new WriteFreelyStatusController(this);
		this.statusController.onload();
	}

	onunload(): void {
		this.statusController?.onunload();
		this.statusController = null;
		this.settingTab = null;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<WriteFreelySettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		await this.statusController?.refresh();
		this.refreshSettingsUi();
	}

	getApiBaseUrl(): string {
		return this.settings.serverUrl.trim().replace(/\/+$/, "");
	}

	async getAccessToken(): Promise<string | null> {
		const token = this.getSecretStorage().getSecret(ACCESS_TOKEN_KEY);
		return token && token.trim() ? token : null;
	}

	async hasAccessToken(): Promise<boolean> {
		try {
			return (await this.getAccessToken()) !== null;
		} catch {
			return false;
		}
	}

	hasSecretStorage(): boolean {
		return Boolean((this.app as AppWithSecretStorage).secretStorage);
	}

	async logIn(alias: string, password: string): Promise<void> {
		const baseUrl = this.getApiBaseUrl();
		if (!baseUrl) {
			throw new Error(
				"Set your WriteFreely server URL in settings before signing in.",
			);
		}

		const response = await this.client.logIn(baseUrl, alias, password);
		this.getSecretStorage().setSecret(
			ACCESS_TOKEN_KEY,
			response.access_token,
		);

		this.settings.username = response.user.username;
		await this.refreshCollections();
		await this.saveSettings();

		new Notice(`Signed in to ${baseUrl} as ${response.user.username}.`);
	}

	async logOut(): Promise<void> {
		const baseUrl = this.getApiBaseUrl();
		const token = await this.getAccessToken();
		if (token && baseUrl) {
			try {
				await this.client.logOut(baseUrl, token);
			} catch {
				// If the remote token is already invalid, we still clear local secrets.
			}
		}

		this.clearAccessToken();
		this.settings.username = "";
		this.settings.collections = [];
		await this.saveSettings();
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		new Notice("Signed out of WriteFreely.");
	}

	async refreshCollections(): Promise<void> {
		const token = await this.getRequiredAccessToken();
		const collections = await this.client.getCollections(
			this.getApiBaseUrl(),
			token,
		);
		this.settings.collections = collections.map((collection) => ({
			alias: collection.alias,
			title: collection.title,
			url: collection.url,
		}));

		if (
			this.settings.defaultCollection &&
			!this.settings.collections.some(
				(collection) =>
					collection.alias === this.settings.defaultCollection,
			)
		) {
			this.settings.defaultCollection = "";
		}
	}

	openLoginModal(): void {
		if (!this.hasSecretStorage()) {
			new Notice(
				"Obsidian secret storage is not available in this app version.",
			);
			return;
		}

		new LoginModal(this.app, this).open();
	}

	getActiveMarkdownFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ?? null;
	}

	async publishActiveNote(): Promise<void> {
		const file = this.getActiveMarkdownFile();
		if (!file) {
			new Notice("Open a Markdown note to publish it.");
			return;
		}

		await this.publishNote(file);
	}

	async saveDraftActiveNote(): Promise<void> {
		const file = this.getActiveMarkdownFile();
		if (!file) {
			new Notice("Open a Markdown note to save it as a draft.");
			return;
		}

		await this.saveDraft(file);
	}

	async moveActiveNoteToDrafts(): Promise<void> {
		const file = this.getActiveMarkdownFile();
		if (!file) {
			new Notice("Open a Markdown note to move it to drafts.");
			return;
		}

		await this.moveNoteToDrafts(file);
	}

	async deleteActiveRemotePost(): Promise<void> {
		const file = this.getActiveMarkdownFile();
		if (!file) {
			new Notice("Open a Markdown note to delete its remote post.");
			return;
		}

		await this.deleteRemotePost(file);
	}

	async publishNote(file: TFile): Promise<void> {
		const result = await this.upsertRemotePost(file, "published");
		const destination = result.metadata.wf_collection
			? ` to ${result.metadata.wf_collection}`
			: "";
		new Notice(`Published "${file.basename}"${destination}.`);
	}

	async saveDraft(file: TFile): Promise<void> {
		await this.upsertRemotePost(file, "draft");
		new Notice(`Saved "${file.basename}" as a WriteFreely draft.`);
	}

	async moveNoteToDrafts(file: TFile): Promise<void> {
		const metadata = getWriteFreelyMetadata(this.app, file, this.settings);
		if (!metadata.wf_post_id) {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice("This note has not been published to WriteFreely yet.");
			return;
		}

		const token = await this.getRequiredAccessToken();
		await this.client.unpublishPost(
			this.getApiBaseUrl(),
			metadata.wf_post_id,
			token,
		);
		await upsertWriteFreelyFrontmatter(this.app, file, {
			wf_status: "draft",
			wf_published_at: null,
		});

		await this.statusController?.refresh();
		new Notice(`Moved "${file.basename}" back to drafts.`);
	}

	async deleteRemotePost(file: TFile): Promise<void> {
		const metadata = getWriteFreelyMetadata(this.app, file, this.settings);
		if (!metadata.wf_post_id) {
			// eslint-disable-next-line obsidianmd/ui/sentence-case
			new Notice("This note does not have a remote WriteFreely post.");
			return;
		}

		const confirmed = await ConfirmModal.open(this.app, {
			title: "Delete remote post?",
			description: `Delete the WriteFreely post linked to "${file.basename}"? The local note will stay in your vault.`,
			confirmLabel: "Delete remote post",
		});
		if (!confirmed) {
			return;
		}

		const token = await this.getRequiredAccessToken();
		await this.client.deletePost(
			this.getApiBaseUrl(),
			metadata.wf_post_id,
			token,
		);
		await upsertWriteFreelyFrontmatter(this.app, file, {
			wf_post_id: null,
			wf_collection: null,
			wf_status: null,
			wf_published_at: null,
		});

		await this.statusController?.refresh();
		new Notice(
			`Deleted the remote WriteFreely post for "${file.basename}".`,
		);
	}

	async refreshStatus(): Promise<void> {
		await this.statusController?.refresh();
	}

	private async upsertRemotePost(
		file: TFile,
		targetStatus: WriteFreelyStatus,
	): Promise<NotePublishResult> {
		const token = await this.getRequiredAccessToken();
		const metadata = getWriteFreelyMetadata(this.app, file, this.settings);
		const content = await this.app.vault.cachedRead(file);
		const noteBody = stripYamlFrontmatter(content).trim();

		if (!noteBody) {
			throw new Error(
				"The current note is empty after removing frontmatter.",
			);
		}

		const title = this.getNoteTitle(file);
		const desiredCollection =
			metadata.wf_collection || this.settings.defaultCollection || "";
		let post: WriteFreelyPost;
		let finalStatus: WriteFreelyStatus = targetStatus;

		if (!metadata.wf_post_id) {
			if (targetStatus === "published") {
				if (!desiredCollection) {
					throw new Error(
						"Set `wf_collection` in frontmatter or choose a default collection in settings before publishing.",
					);
				}

				post = await this.client.createCollectionPost(
					this.getApiBaseUrl(),
					desiredCollection,
					{
						body: noteBody,
						title,
					},
					token,
				);
			} else {
				post = await this.client.createPost(
					this.getApiBaseUrl(),
					{
						body: noteBody,
						title,
					},
					token,
				);
				finalStatus = "draft";
			}
		} else {
			post = await this.client.updatePost(
				this.getApiBaseUrl(),
				metadata.wf_post_id,
				{
					body: noteBody,
					title,
				},
				token,
			);

			if (targetStatus === "published") {
				if (!desiredCollection) {
					if (metadata.wf_status !== "published") {
						throw new Error(
							"Set `wf_collection` in frontmatter or choose a default collection in settings before publishing.",
						);
					}
				} else if (
					metadata.wf_status !== "published" ||
					metadata.wf_collection !== desiredCollection
				) {
					post = await this.client.movePostToCollection(
						this.getApiBaseUrl(),
						desiredCollection,
						metadata.wf_post_id,
						token,
					);
				}
			} else {
				finalStatus = "draft";
			}
		}

		const publishedCollection =
			post.collection?.alias ?? (desiredCollection || "");
		const nextStatus =
			targetStatus === "published" ? "published" : finalStatus;

		await upsertWriteFreelyFrontmatter(this.app, file, {
			wf_post_id: post.id,
			wf_collection:
				publishedCollection || metadata.wf_collection || null,
			wf_status: nextStatus,
			wf_published_at:
				nextStatus === "published"
					? (post.created ??
						metadata.wf_published_at ??
						new Date().toISOString())
					: null,
		});

		await this.statusController?.refresh();

		return {
			post,
			metadata: {
				...metadata,
				wf_post_id: post.id,
				wf_collection:
					publishedCollection || metadata.wf_collection || undefined,
				wf_status: nextStatus,
				wf_published_at:
					nextStatus === "published"
						? (post.created ??
							metadata.wf_published_at ??
							new Date().toISOString())
						: undefined,
			},
		};
	}

	private getNoteTitle(file: TFile): string {
		const frontmatter =
			this.app.metadataCache.getFileCache(file)?.frontmatter;
		const frontmatterTitle =
			typeof frontmatter?.title === "string"
				? frontmatter.title.trim()
				: "";
		return frontmatterTitle || file.basename;
	}

	private async getRequiredAccessToken(): Promise<string> {
		const token = await this.getAccessToken();
		if (!token) {
			throw new Error("Sign in to WriteFreely first.");
		}
		return token;
	}

	private getSecretStorage(): SecretStorageCompat {
		const secretStorage = (this.app as AppWithSecretStorage).secretStorage;
		if (!secretStorage) {
			throw new Error(
				"Obsidian secret storage is not available in this app version.",
			);
		}
		return secretStorage;
	}

	private clearAccessToken(): void {
		const secretStorage = this.getSecretStorage();
		if (typeof secretStorage.deleteSecret === "function") {
			secretStorage.deleteSecret(ACCESS_TOKEN_KEY);
			return;
		}

		if (typeof secretStorage.removeSecret === "function") {
			secretStorage.removeSecret(ACCESS_TOKEN_KEY);
			return;
		}

		secretStorage.setSecret(ACCESS_TOKEN_KEY, "");
	}

	private refreshSettingsUi(): void {
		if (!this.settingTab || !this.settingTab.containerEl.isConnected) {
			return;
		}

		this.settingTab.display();
	}
}

type AppWithSecretStorage = App & {
	secretStorage?: SecretStorageCompat;
};

function stripYamlFrontmatter(content: string): string {
	if (!content.startsWith("---")) {
		return content;
	}

	const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	if (!match) {
		return content;
	}

	return content.slice(match[0].length);
}
