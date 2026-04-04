export type WriteFreelyStatus = "draft" | "published";

export interface WriteFreelyCollection {
	alias: string;
	title: string;
	url?: string;
	public?: boolean;
}

export interface WriteFreelyPost {
	id: string;
	slug?: string | null;
	title?: string;
	body?: string;
	created?: string;
	updated?: string;
	collection?: WriteFreelyCollection;
}

export interface WriteFreelyUser {
	username: string;
	email?: string;
	created?: string;
}

export interface WriteFreelyAuthResponse {
	access_token: string;
	user: WriteFreelyUser;
}

export interface WriteFreelyMetadata {
	wf_post_id?: string;
	wf_collection?: string;
	wf_status?: "draft" | "published";
	wf_published_at?: string;
}

export interface NotePublishResult {
	post: WriteFreelyPost;
	metadata: WriteFreelyMetadata;
}
