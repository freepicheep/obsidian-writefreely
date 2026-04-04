import { requestUrl } from "obsidian";
import type {
	WriteFreelyAuthResponse,
	WriteFreelyCollection,
	WriteFreelyPost,
} from "../types";

interface WriteFreelyEnvelope<T> {
	code: number;
	data: T;
	error_msg?: string;
}

interface WriteFreelyPostRequest {
	body: string;
	title?: string;
}

interface WriteFreelyCollectResponseItem {
	code: number;
	post?: WriteFreelyPost;
	error_msg?: string;
}

export class WriteFreelyClient {
	async logIn(
		baseUrl: string,
		alias: string,
		password: string,
	): Promise<WriteFreelyAuthResponse> {
		return await this.request<WriteFreelyAuthResponse>(
			baseUrl,
			"/auth/login",
			{
				method: "POST",
				body: {
					alias,
					pass: password,
				},
			},
		);
	}

	async logOut(baseUrl: string, token: string): Promise<void> {
		await this.request<void>(baseUrl, "/auth/me", {
			method: "DELETE",
			token,
		});
	}

	async getCollections(
		baseUrl: string,
		token: string,
	): Promise<WriteFreelyCollection[]> {
		return await this.request<WriteFreelyCollection[]>(
			baseUrl,
			"/me/collections",
			{
				method: "GET",
				token,
			},
		);
	}

	async createPost(
		baseUrl: string,
		post: WriteFreelyPostRequest,
		token: string,
	): Promise<WriteFreelyPost> {
		return await this.request<WriteFreelyPost>(baseUrl, "/posts", {
			method: "POST",
			token,
			body: post,
		});
	}

	async createCollectionPost(
		baseUrl: string,
		collectionAlias: string,
		post: WriteFreelyPostRequest,
		token: string,
	): Promise<WriteFreelyPost> {
		return await this.request<WriteFreelyPost>(
			baseUrl,
			`/collections/${encodeURIComponent(collectionAlias)}/posts`,
			{
				method: "POST",
				token,
				body: post,
			},
		);
	}

	async updatePost(
		baseUrl: string,
		postId: string,
		post: WriteFreelyPostRequest,
		token: string,
	): Promise<WriteFreelyPost> {
		return await this.request<WriteFreelyPost>(
			baseUrl,
			`/posts/${encodeURIComponent(postId)}`,
			{
				method: "POST",
				token,
				body: post,
			},
		);
	}

	async unpublishPost(
		baseUrl: string,
		postId: string,
		token: string,
	): Promise<void> {
		await this.request<WriteFreelyPost>(
			baseUrl,
			`/posts/${encodeURIComponent(postId)}`,
			{
				method: "POST",
				token,
				body: { body: "" },
			},
		);
	}

	async movePostToCollection(
		baseUrl: string,
		collectionAlias: string,
		postId: string,
		token: string,
	): Promise<WriteFreelyPost> {
		const results = await this.request<WriteFreelyCollectResponseItem[]>(
			baseUrl,
			`/collections/${encodeURIComponent(collectionAlias)}/collect`,
			{
				method: "POST",
				token,
				body: [{ id: postId }],
			},
		);
		const result = results[0];
		if (!result) {
			throw new Error(
				"WriteFreely returned an empty collection move response.",
			);
		}

		if (result.code < 200 || result.code >= 300 || !result.post) {
			throw new Error(
				result.error_msg ||
					"WriteFreely could not move the post into the collection.",
			);
		}

		return result.post;
	}

	async deletePost(
		baseUrl: string,
		postId: string,
		token: string,
	): Promise<void> {
		await this.request<void>(
			baseUrl,
			`/posts/${encodeURIComponent(postId)}`,
			{
				method: "DELETE",
				token,
			},
		);
	}

	private async request<T>(
		baseUrl: string,
		path: string,
		options: {
			method: string;
			token?: string;
			body?: unknown;
		},
	): Promise<T> {
		const url = `${baseUrl}/api${path}`;
		const response = await requestUrl({
			url,
			method: options.method,
			contentType: "application/json",
			headers: {
				...(options.token
					? { Authorization: `Token ${options.token}` }
					: {}),
			},
			body: options.body ? JSON.stringify(options.body) : undefined,
			throw: false,
		});

		if (!response.text) {
			if (response.status >= 200 && response.status < 300) {
				return undefined as T;
			}

			throw new Error(
				`WriteFreely request failed with status ${response.status}.`,
			);
		}

		const json = response.json as
			| WriteFreelyEnvelope<T>
			| { error_msg?: string; code?: number };
		if (response.status < 200 || response.status >= 300) {
			throw new Error(
				json.error_msg ||
					`WriteFreely request failed with status ${response.status}.`,
			);
		}

		if ("data" in json) {
			return json.data;
		}

		throw new Error("WriteFreely returned an unexpected response.");
	}
}
