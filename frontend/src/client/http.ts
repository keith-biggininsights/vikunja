import {client} from '@/client/generated/client.gen'
import type {ResolvedRequestOptions} from '@/client/generated/client/types.gen'
import {getToken, getTokenType, refreshToken} from '@/helpers/auth'
import {getApiBaseUrl} from '@/helpers/fetcher'
import {AUTH_TYPES} from '@/modelTypes/IUser'

function getApiV2BaseUrl(): string {
	return getApiBaseUrl().replace(/\/api\/v1\/$/, '/api/v2')
}

async function getProblemCode(response: Response): Promise<number | null> {
	try {
		const problem = await response.clone().json() as {code?: unknown}
		return typeof problem.code === 'number' ? problem.code : null
	} catch {
		return null
	}
}

export function configureApiClient(): void {
	client.setConfig({
		baseUrl: getApiV2BaseUrl(),
		credentials: 'include',
		throwOnError: true,
	})
	client.interceptors.request.clear()
	client.interceptors.response.clear()
	client.interceptors.error.clear()

	client.interceptors.request.use((request) => {
		const headers = new Headers(request.headers)
		const token = getToken()
		if (token) {
			headers.set('Authorization', `Bearer ${token}`)
		} else {
			headers.delete('Authorization')
		}
		return new Request(request, {headers})
	})

	client.interceptors.response.use(async (response, request, options: ResolvedRequestOptions) => {
		if (response.status !== 401 || await getProblemCode(response) !== 11) {
			return response
		}

		const token = getToken()
		if (!token || getTokenType(token) !== AUTH_TYPES.USER) {
			return response
		}

		try {
			await refreshToken(true)
		} catch {
			return response
		}

		const replacementToken = getToken()
		if (!replacementToken) {
			return response
		}

		const headers = new Headers(request.headers)
		headers.set('Authorization', `Bearer ${replacementToken}`)
		const retry = new Request(request, {headers})
		return (options.fetch ?? globalThis.fetch)(retry)
	})
}
