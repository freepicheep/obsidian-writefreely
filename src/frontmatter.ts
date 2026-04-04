import type { App, TFile } from "obsidian";
import type { WriteFreelySettings } from "./settings";
import type { WriteFreelyMetadata } from "./types";

type WriteFreelyFrontmatterUpdate = {
	[K in keyof WriteFreelyMetadata]?: WriteFreelyMetadata[K] | null;
};

type MutableFrontmatter = Record<string, unknown>;

export function getWriteFreelyMetadata(
	app: App,
	file: TFile,
	settings: WriteFreelySettings,
): WriteFreelyMetadata {
	const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;

	return {
		wf_post_id: readString(frontmatter?.wf_post_id),
		wf_collection:
			readString(frontmatter?.wf_collection) ||
			settings.defaultCollection ||
			undefined,
		wf_status: readStatus(frontmatter?.wf_status),
		wf_published_at: readString(frontmatter?.wf_published_at),
	};
}

export async function upsertWriteFreelyFrontmatter(
	app: App,
	file: TFile,
	update: WriteFreelyFrontmatterUpdate,
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (frontmatter) => {
		const mutableFrontmatter = frontmatter as MutableFrontmatter;

		for (const [key, value] of Object.entries(update)) {
			if (value === null || value === undefined || value === "") {
				delete mutableFrontmatter[key];
				continue;
			}

			mutableFrontmatter[key] = value;
		}
	});
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStatus(value: unknown): "draft" | "published" | undefined {
	return value === "draft" || value === "published" ? value : undefined;
}
