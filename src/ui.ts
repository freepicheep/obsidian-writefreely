import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import WriteFreelyPlugin from "./main";

export class LoginModal extends Modal {
	private readonly plugin: WriteFreelyPlugin;
	private alias = "";
	private password = "";

	constructor(app: App, plugin: WriteFreelyPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Sign in to WriteFreely" });
		contentEl.createEl("p", {
			text: "Your access token is stored in Obsidian's secret storage after login."
		});

		new Setting(contentEl)
			.setName("Username")
			.addText((text) => text
				.setPlaceholder("matt")
				.onChange((value) => {
					this.alias = value.trim();
				}));

		new Setting(contentEl)
			.setName("Password")
			.addText((text) => {
				text.setPlaceholder("Password");
				text.inputEl.type = "password";
				text.onChange((value: string) => {
					this.password = value;
				});
			});

		const footer = contentEl.createDiv({ cls: "writefreely-modal-actions" });
		new ButtonComponent(footer)
			.setButtonText("Cancel")
			.onClick(() => this.close());
		new ButtonComponent(footer)
			.setButtonText("Sign in")
			.setCta()
			.onClick(() => {
				void this.submit();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		if (!this.alias || !this.password) {
			new Notice("Enter both your WriteFreely username and password.");
			return;
		}

		try {
			await this.plugin.logIn(this.alias, this.password);
			this.close();
		} catch (error) {
			new Notice(error instanceof Error ? error.message : "Sign-in failed.");
		}
	}
}

export class ConfirmModal extends Modal {
	private readonly titleText: string;
	private readonly description: string;
	private readonly confirmLabel: string;
	private resolver: ((value: boolean) => void) | null = null;

	constructor(app: App, options: { title: string; description: string; confirmLabel: string }) {
		super(app);
		this.titleText = options.title;
		this.description = options.description;
		this.confirmLabel = options.confirmLabel;
	}

	static async open(
		app: App,
		options: { title: string; description: string; confirmLabel: string }
	): Promise<boolean> {
		return await new Promise<boolean>((resolve) => {
			const modal = new ConfirmModal(app, options);
			modal.resolver = resolve;
			modal.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: this.titleText });
		contentEl.createEl("p", { text: this.description });

		const footer = contentEl.createDiv({ cls: "writefreely-modal-actions" });
		new ButtonComponent(footer)
			.setButtonText("Cancel")
			.onClick(() => this.resolve(false));
		new ButtonComponent(footer)
			.setWarning()
			.setButtonText(this.confirmLabel)
			.onClick(() => this.resolve(true));
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.resolver) {
			this.resolver(false);
			this.resolver = null;
		}
	}

	private resolve(value: boolean): void {
		this.resolver?.(value);
		this.resolver = null;
		this.close();
	}
}
