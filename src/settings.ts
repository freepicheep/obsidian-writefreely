import {
	type App,
	Notice,
	PluginSettingTab,
	Setting,
	type TextComponent,
} from "obsidian";
import type WriteFreelyPlugin from "./main";

export interface SavedWriteFreelyCollection {
	alias: string;
	title: string;
	url?: string;
}

export interface WriteFreelySettings {
	serverUrl: string;
	username: string;
	defaultCollection: string;
	collections: SavedWriteFreelyCollection[];
}

export const DEFAULT_SETTINGS: WriteFreelySettings = {
	serverUrl: "https://write.as",
	username: "",
	defaultCollection: "",
	collections: [],
};

export class WriteFreelySettingTab extends PluginSettingTab {
	plugin: WriteFreelyPlugin;
	private serverUrlDraft: string | null = null;

	constructor(app: App, plugin: WriteFreelyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	override hide(): void {
		super.hide();
		void this.saveServerUrlDraft();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const isSignedIn = Boolean(this.plugin.settings.username);
		const serverUrlValue =
			this.serverUrlDraft ?? this.plugin.settings.serverUrl;

		 new Setting(containerEl)
			.setClass("writefreely-server-url-setting")
			.setName("Server address")
			.setDesc("Base address for your publishing site.")
			.addText((text) => {
				text
					.setDisabled(isSignedIn)
					.setPlaceholder("https://write.as")
					.setValue(serverUrlValue)
					.onChange((value) => {
						this.serverUrlDraft = value;
						this.updateServerUrlInputWidth(text, value);
					});
				this.updateServerUrlInputWidth(text, serverUrlValue);
			});

		new Setting(containerEl)
			.setName("Account")
			.setDesc(
				!this.plugin.hasSecretStorage()
					? "This Obsidian build does not expose secret storage, so sign-in is unavailable."
					: isSignedIn
						? `Signed in as ${this.plugin.settings.username}.`
						: "Sign in to store your WriteFreely access token in Obsidian's secret storage.",
			)
			.addButton((button) =>
				button
					.setButtonText(
						isSignedIn ? "Sign out" : "Sign in",
					)
					.setDisabled(!this.plugin.hasSecretStorage())
					.onClick(async () => {
						try {
							if (isSignedIn && (await this.plugin.hasAccessToken())) {
								await this.plugin.logOut();
								this.display();
								return;
							}

							await this.saveServerUrlDraft();
							this.plugin.openLoginModal();
						} catch (error) {
							new Notice(
								error instanceof Error
									? error.message
									: "Unable to open WriteFreely sign-in.",
							);
						}
					}),
			)
			.addExtraButton((button) =>
				button
					.setIcon("refresh-cw")
					.setTooltip("Refresh collections")
					.setDisabled(!isSignedIn)
					.onClick(async () => {
						await this.plugin.refreshCollections();
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		const hasCollections = this.plugin.settings.collections.length > 0;
		new Setting(containerEl)
			.setName("Default collection")
			.setDesc(
				"Used when a note does not define `wf_collection` in frontmatter.",
			)
			.addDropdown((dropdown) => {
				dropdown.addOption("", "None");
				for (const collection of this.plugin.settings.collections) {
					dropdown.addOption(
						collection.alias,
						`${collection.title} (${collection.alias})`,
					);
				}

				dropdown
					.setValue(this.plugin.settings.defaultCollection)
					.setDisabled(!hasCollections)
					.onChange(async (value) => {
						this.plugin.settings.defaultCollection = value;
						await this.plugin.saveSettings();
					});
			});

		if (!hasCollections) {
			containerEl.createEl("p", {
				cls: "writefreely-settings-hint",
				text: "No collections loaded yet. Sign in and refresh collections to choose a default blog.",
			});
		}
	}

	private async saveServerUrlDraft(): Promise<void> {
		const nextServerUrl = (
			this.serverUrlDraft ?? this.plugin.settings.serverUrl
		).trim();
		this.serverUrlDraft = nextServerUrl;

		if (nextServerUrl === this.plugin.settings.serverUrl) {
			return;
		}

		this.plugin.settings.serverUrl = nextServerUrl;
		await this.plugin.saveSettings({
			refreshStatus: false,
			refreshUi: false,
		});
	}

	private updateServerUrlInputWidth(
		text: TextComponent,
		value: string,
	): void {
		const displayValue = value.trim() || text.inputEl.placeholder;
		const width = Math.max(text.inputEl.placeholder.length, displayValue.length + 1);
		text.inputEl.style.width = `${width}ch`;
	}
}
