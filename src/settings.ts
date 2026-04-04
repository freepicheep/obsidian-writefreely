import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import WriteFreelyPlugin from "./main";

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
	collections: []
};

export class WriteFreelySettingTab extends PluginSettingTab {
	plugin: WriteFreelyPlugin;

	constructor(app: App, plugin: WriteFreelyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "WriteFreely" });

		new Setting(containerEl)
			.setName("Server URL")
			.setDesc("Base URL for your WriteFreely instance.")
			.addText((text) => text
				.setPlaceholder("https://write.as")
				.setValue(this.plugin.settings.serverUrl)
				.onChange(async (value) => {
					this.plugin.settings.serverUrl = value.trim();
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(containerEl)
			.setName("Account")
			.setDesc(!this.plugin.hasSecretStorage()
				? "This Obsidian build does not expose secret storage, so sign-in is unavailable."
				: this.plugin.settings.username
					? `Signed in as ${this.plugin.settings.username}.`
					: "Sign in to store your WriteFreely access token in Obsidian's secret storage.")
			.addButton((button) => button
				.setButtonText(this.plugin.settings.username ? "Sign out" : "Sign in")
				.setDisabled(!this.plugin.hasSecretStorage())
				.onClick(async () => {
					try {
						if (this.plugin.settings.username && await this.plugin.hasAccessToken()) {
							await this.plugin.logOut();
							this.display();
							return;
						}

						this.plugin.openLoginModal();
					} catch (error) {
						new Notice(error instanceof Error ? error.message : "Unable to open WriteFreely sign-in.");
					}
				}))
			.addExtraButton((button) => button
				.setIcon("refresh-cw")
				.setTooltip("Refresh collections")
				.setDisabled(!this.plugin.settings.username)
				.onClick(async () => {
					await this.plugin.refreshCollections();
					await this.plugin.saveSettings();
					this.display();
				}));

		const hasCollections = this.plugin.settings.collections.length > 0;
		new Setting(containerEl)
			.setName("Default collection")
			.setDesc("Used when a note does not define `wf_collection` in frontmatter.")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "None");
				for (const collection of this.plugin.settings.collections) {
					dropdown.addOption(collection.alias, `${collection.title} (${collection.alias})`);
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
				text: "No collections loaded yet. Sign in and refresh collections to choose a default blog."
			});
		}
	}
}
