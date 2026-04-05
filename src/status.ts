import { MarkdownView, Menu, Notice, type TFile, setIcon } from "obsidian";
import type WriteFreelyPlugin from "./main";
import { getWriteFreelyMetadata } from "./frontmatter";

const ACTION_CLASS = "writefreely-view-action";

export class WriteFreelyStatusController {
	private readonly plugin: WriteFreelyPlugin;
	private readonly actionButtons = new Map<MarkdownView, HTMLElement>();
	private statusBarItemEl: HTMLElement | null = null;

	constructor(plugin: WriteFreelyPlugin) {
		this.plugin = plugin;
	}

	onload(): void {
		try {
			this.statusBarItemEl = this.plugin.addStatusBarItem();
			this.statusBarItemEl.addClass("mod-clickable");
			this.statusBarItemEl.addClass("writefreely-status-bar");
			this.statusBarItemEl.addEventListener("click", (event) => {
				void this.openMenu(event);
			});
		} catch {
			this.statusBarItemEl = null;
		}

		this.plugin.registerEvent(
			this.plugin.app.workspace.on("file-open", () => {
				void this.refresh();
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.workspace.on("active-leaf-change", () => {
				void this.refresh();
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.metadataCache.on("changed", (file) => {
				if (file.path === this.plugin.getActiveMarkdownFile()?.path) {
					void this.refresh();
				}
			}),
		);
		this.plugin.registerEvent(
			this.plugin.app.vault.on("rename", () => {
				void this.refresh();
			}),
		);

		void this.refresh();
	}

	onunload(): void {
		this.clearViewActions();
		this.statusBarItemEl?.detach();
		this.statusBarItemEl = null;
	}

	async refresh(): Promise<void> {
		const view =
			this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
		const file = view?.file ?? null;
		this.updateStatusBar(file);
		this.updateViewActions();
	}

	private updateStatusBar(file: TFile | null): void {
		if (!this.statusBarItemEl) {
			return;
		}

		const label = this.getStatusLabel(file);
		this.statusBarItemEl.setText(`WriteFreely: ${label}`);
	}

	private updateViewActions(): void {
		const leaves = this.plugin.app.workspace.getLeavesOfType("markdown");
		const visibleViews = new Set<MarkdownView>();

		for (const leaf of leaves) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) {
				continue;
			}

			visibleViews.add(view);
			this.updateViewAction(view, view.file ?? null);
		}

		for (const [view, button] of this.actionButtons) {
			if (visibleViews.has(view)) {
				continue;
			}

			button.remove();
			this.actionButtons.delete(view);
		}
	}

	private updateViewAction(view: MarkdownView, file: TFile | null): void {
		if (!this.plugin.settings.showToolbarAction) {
			this.removeViewAction(view);
			return;
		}

		let button = this.actionButtons.get(view);
		if (!button) {
			button = view.addAction(
				"square-pen",
				"WriteFreely",
				(event: MouseEvent) => {
					void this.openMenu(event);
				},
			);
			button.addClass(ACTION_CLASS);
			this.actionButtons.set(view, button);
		}

		const { icon, label, tooltip } = this.describeState(file);
		setIcon(button, icon);
		button.setAttribute("aria-label", tooltip);
		button.setAttribute("data-wf-label", label);
		button.setAttribute("title", tooltip);
	}

	private removeViewAction(view: MarkdownView): void {
		const button = this.actionButtons.get(view);
		if (!button) {
			return;
		}

		button.remove();
		this.actionButtons.delete(view);
	}

	private clearViewActions(): void {
		for (const button of this.actionButtons.values()) {
			button.remove();
		}
		this.actionButtons.clear();
	}

	private async openMenu(event: MouseEvent): Promise<void> {
		const file = this.plugin.getActiveMarkdownFile();
		const menu = new Menu();
		const token = await this.plugin.getAccessToken();

		if (!file) {
			menu.addItem((item) =>
				item.setTitle("Open a Markdown note").setIcon("file-text"),
			);
			menu.showAtMouseEvent(event);
			return;
		}

		if (!token) {
			menu.addItem((item) =>
				item
					.setTitle("Sign in")
					.setIcon("log-in")
					.onClick(() => this.plugin.openLoginModal()),
			);
			menu.showAtMouseEvent(event);
			return;
		}

		const metadata = getWriteFreelyMetadata(
			this.plugin.app,
			file,
			this.plugin.settings,
		);

		menu.addItem((item) =>
			item
				.setTitle(
					metadata.wf_status === "published"
						? "Update published post"
						: "Publish note",
				)
				.setIcon("send")
				.onClick(() => {
					void this.runAction(() => this.plugin.publishNote(file));
				}),
		);

		menu.addItem((item) =>
			item
				.setTitle("Save draft")
				.setIcon("file-pen")
				.onClick(() => {
					void this.runAction(() => this.plugin.saveDraft(file));
				}),
		);

		if (metadata.wf_post_id && metadata.wf_status === "published") {
			menu.addItem((item) =>
				item
					.setTitle("Move to drafts")
					.setIcon("archive")
					.onClick(() => {
						void this.runAction(() =>
							this.plugin.moveNoteToDrafts(file),
						);
					}),
			);
		}

		if (metadata.wf_post_id) {
			menu.addItem((item) =>
				item
					.setTitle("Delete remote post")
					.setIcon("trash-2")
					.onClick(() => {
						void this.runAction(() =>
							this.plugin.deleteRemotePost(file),
						);
					}),
			);
		}

		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Refresh collections")
				.setIcon("refresh-cw")
				.onClick(() => {
					void this.runAction(async () => {
						await this.plugin.refreshCollections();
						await this.plugin.saveSettings();
					});
				}),
		);
		menu.addItem((item) =>
			item
				.setTitle("Sign out")
				.setIcon("log-out")
				.onClick(() => {
					void this.runAction(() => this.plugin.logOut());
				}),
		);

		menu.showAtMouseEvent(event);
	}

	private async runAction(action: () => Promise<void>): Promise<void> {
		try {
			await action();
		} catch (error) {
			new Notice(getErrorMessage(error));
		} finally {
			await this.refresh();
		}
	}

	private getStatusLabel(file: TFile | null): string {
		return this.describeState(file).label;
	}

	private describeState(file: TFile | null): {
		icon: string;
		label: string;
		tooltip: string;
	} {
		if (!file) {
			return {
				icon: "square-pen",
				label: "No note",
				tooltip: "Open a Markdown note to manage it in WriteFreely.",
			};
		}

		const metadata = getWriteFreelyMetadata(
			this.plugin.app,
			file,
			this.plugin.settings,
		);
		if (!metadata.wf_post_id) {
			return {
				icon: "square-pen",
				label: "Local",
				tooltip: "This note has not been created on WriteFreely yet.",
			};
		}

		if (metadata.wf_status === "published") {
			return {
				icon: "send",
				label: "Published",
				tooltip: metadata.wf_collection
					? `Published to ${metadata.wf_collection}.`
					: "Published on WriteFreely.",
			};
		}

		return {
			icon: "file-pen",
			label: "Draft",
			tooltip: "Saved to WriteFreely as a draft.",
		};
	}
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return "Something went wrong while talking to WriteFreely.";
}
