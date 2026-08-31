import {describe, expect, it} from 'vitest'

import TaskModel from './task'

describe('TaskModel labels', () => {
	it('preserves generated label field casing', () => {
		const task = new TaskModel({
			labels: [{id: 1, title: 'Label', hex_color: 'ff006e'}],
		})

		expect(task.labels).toEqual([{id: 1, title: 'Label', hex_color: 'ff006e'}])
		expect(task.labels[0]).not.toHaveProperty('hexColor')
	})
})
