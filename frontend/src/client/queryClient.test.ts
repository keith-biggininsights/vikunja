import {describe, expect, it} from 'vitest'

import {queryClient} from './queryClient'

describe('queryClient', () => {
	it('uses the shared query and mutation defaults', () => {
		expect(queryClient.getDefaultOptions()).toMatchObject({
			queries: {
				staleTime: 60_000,
				retry: 1,
				refetchOnWindowFocus: false,
			},
			mutations: {
				retry: false,
			},
		})
	})
})
