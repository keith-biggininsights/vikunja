import {beforeEach, describe, expect, it, vi} from 'vitest'

import {client} from './generated/client.gen'
import {configureApiClient} from './http'

const auth = vi.hoisted(() => ({
	token: null as string | null,
	type: null as number | null,
	refreshToken: vi.fn(),
}))

vi.mock('@/helpers/auth', () => ({
	getToken: () => auth.token,
	getTokenType: () => auth.type,
	refreshToken: auth.refreshToken,
}))

const problem = (code: number, detail = 'request failed') => new Response(JSON.stringify({code, detail}), {
	status: 401,
	headers: {'Content-Type': 'application/problem+json'},
})

const ok = () => new Response(JSON.stringify({ok: true}), {
	status: 200,
	headers: {'Content-Type': 'application/json'},
})

describe('configureApiClient', () => {
	let requests: Request[]
	let responses: Response[]

	beforeEach(() => {
		window.API_URL = 'https://api.example.com/root/api/v1'
		auth.token = null
		auth.type = null
		auth.refreshToken.mockReset()
		requests = []
		responses = [ok()]
		vi.stubGlobal('fetch', vi.fn(async (request: Request) => {
			requests.push(request)
			return responses.shift() ?? ok()
		}))
		configureApiClient()
	})

	it('configures the v2 base URL and includes credentials', async () => {
		await client.get({url: '/probe'})

		expect(requests[0].url).toBe('https://api.example.com/root/api/v2/probe')
		expect(requests[0].credentials).toBe('include')
	})

	it('adds the current bearer token', async () => {
		auth.token = 'current-token'

		await client.get({url: '/probe'})

		expect(requests[0].headers.get('Authorization')).toBe('Bearer current-token')
	})

	it('refreshes an expired user token and retries once', async () => {
		auth.token = 'expired-token'
		auth.type = 1
		responses = [problem(11), ok()]
		auth.refreshToken.mockImplementation(async () => {
			auth.token = 'replacement-token'
		})

		await client.get({url: '/probe'})

		expect(auth.refreshToken).toHaveBeenCalledOnce()
		expect(auth.refreshToken).toHaveBeenCalledWith(true)
		expect(requests).toHaveLength(2)
		expect(requests[1].headers.get('Authorization')).toBe('Bearer replacement-token')
	})

	it('does not refresh link-share tokens', async () => {
		auth.token = 'link-share-token'
		auth.type = 2
		responses = [problem(11)]

		await expect(client.get({url: '/probe'})).rejects.toMatchObject({code: 11})

		expect(auth.refreshToken).not.toHaveBeenCalled()
		expect(requests).toHaveLength(1)
	})

	it('does not refresh without a token', async () => {
		auth.type = 1
		responses = [problem(11)]

		await expect(client.get({url: '/probe'})).rejects.toMatchObject({code: 11})

		expect(auth.refreshToken).not.toHaveBeenCalled()
		expect(requests).toHaveLength(1)
	})

	it('does not retry other 401 responses', async () => {
		auth.token = 'current-token'
		auth.type = 1
		responses = [problem(1017)]

		await expect(client.get({url: '/probe'})).rejects.toMatchObject({code: 1017})

		expect(auth.refreshToken).not.toHaveBeenCalled()
		expect(requests).toHaveLength(1)
	})

	it('returns the second 401 problem after one retry', async () => {
		auth.token = 'expired-token'
		auth.type = 1
		responses = [problem(11, 'expired'), problem(11, 'still expired')]
		auth.refreshToken.mockImplementation(async () => {
			auth.token = 'replacement-token'
		})

		await expect(client.get({url: '/probe'})).rejects.toMatchObject({
			code: 11,
			detail: 'still expired',
		})

		expect(auth.refreshToken).toHaveBeenCalledOnce()
		expect(requests).toHaveLength(2)
	})
})
