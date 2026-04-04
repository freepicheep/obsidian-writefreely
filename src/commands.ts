import { Notice } from "obsidian";
import type WriteFreelyPlugin from "./main";

export function registerWriteFreelyCommands(plugin: WriteFreelyPlugin): void {
	plugin.addCommand({
		id: "writefreely-sign-in",
		name: "Sign in",
		callback: () => plugin.openLoginModal(),
	});

	plugin.addCommand({
		id: "writefreely-publish-note",
		name: "Publish active note",
		callback: () => void run(plugin.publishActiveNote.bind(plugin)),
	});

	plugin.addCommand({
		id: "writefreely-save-draft",
		name: "Save active note as draft",
		callback: () => void run(plugin.saveDraftActiveNote.bind(plugin)),
	});

	plugin.addCommand({
		id: "writefreely-move-to-drafts",
		name: "Move active note to drafts",
		callback: () => void run(plugin.moveActiveNoteToDrafts.bind(plugin)),
	});

	plugin.addCommand({
		id: "writefreely-delete-remote-post",
		name: "Delete active note's remote post",
		callback: () => void run(plugin.deleteActiveRemotePost.bind(plugin)),
	});

	plugin.addCommand({
		id: "writefreely-refresh-status",
		name: "Refresh status",
		callback: () => void plugin.refreshStatus(),
	});
}

async function run(action: () => Promise<void>): Promise<void> {
	try {
		await action();
	} catch (error) {
		new Notice(
			error instanceof Error
				? error.message
				: "WriteFreely action failed.",
		);
	}
}
