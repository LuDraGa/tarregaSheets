/**
 * ErrorList component
 *
 * Displays multiple parse errors in a filterable, sortable table.
 * Allows filtering by error type, element type, measure range.
 * Click error → callback to scroll to that line in editor.
 */

import { useState, useMemo } from 'react'
import type { ParseErrorDetails } from '@/types/upload'

interface ErrorListProps {
  errors: ParseErrorDetails[]
  onErrorClick?: (error: ParseErrorDetails) => void
}

type SortField = 'line' | 'measure' | 'exception_type'
type SortOrder = 'asc' | 'desc'

export default function ErrorList({ errors, onErrorClick }: ErrorListProps) {
  const [filterExceptionType, setFilterExceptionType] = useState<string>('all')
  const [filterElement, setFilterElement] = useState<string>('all')
  const [filterMeasureMin, setFilterMeasureMin] = useState<string>('')
  const [filterMeasureMax, setFilterMeasureMax] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('line')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Extract unique exception types and elements for filters
  const exceptionTypes = useMemo(() => {
    const types = new Set<string>()
    errors.forEach((err) => types.add(err.exception_type))
    return Array.from(types).sort()
  }, [errors])

  const elementTypes = useMemo(() => {
    const elements = new Set<string>()
    errors.forEach((err) => {
      if (err.element) elements.add(err.element)
    })
    return Array.from(elements).sort()
  }, [errors])

  // Filter and sort errors
  const filteredAndSortedErrors = useMemo(() => {
    let filtered = [...errors]

    // Filter by exception type
    if (filterExceptionType !== 'all') {
      filtered = filtered.filter((err) => err.exception_type === filterExceptionType)
    }

    // Filter by element type
    if (filterElement !== 'all') {
      filtered = filtered.filter((err) => err.element === filterElement)
    }

    // Filter by measure range
    if (filterMeasureMin) {
      const min = parseInt(filterMeasureMin)
      filtered = filtered.filter((err) => {
        if (!err.measure) return false
        const measureNum = parseInt(err.measure)
        return !isNaN(measureNum) && measureNum >= min
      })
    }
    if (filterMeasureMax) {
      const max = parseInt(filterMeasureMax)
      filtered = filtered.filter((err) => {
        if (!err.measure) return false
        const measureNum = parseInt(err.measure)
        return !isNaN(measureNum) && measureNum <= max
      })
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = null
      let bVal: any = null

      if (sortField === 'line') {
        aVal = a.line ?? Infinity
        bVal = b.line ?? Infinity
      } else if (sortField === 'measure') {
        aVal = a.measure ? parseInt(a.measure) : Infinity
        bVal = b.measure ? parseInt(b.measure) : Infinity
      } else if (sortField === 'exception_type') {
        aVal = a.exception_type
        bVal = b.exception_type
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [errors, filterExceptionType, filterElement, filterMeasureMin, filterMeasureMax, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleReset = () => {
    setFilterExceptionType('all')
    setFilterElement('all')
    setFilterMeasureMin('')
    setFilterMeasureMax('')
    setSortField('line')
    setSortOrder('asc')
  }

  if (errors.length === 0) {
    return null
  }

  return (
    <div className="bg-white border border-red-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-red-50 px-4 py-3 border-b border-red-200">
        <h3 className="text-sm font-semibold text-red-800">
          Multiple Parse Errors Found ({filteredAndSortedErrors.length} of {errors.length})
        </h3>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Exception Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Error Type
            </label>
            <select
              value={filterExceptionType}
              onChange={(e) => setFilterExceptionType(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Types</option>
              {exceptionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Element Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Element
            </label>
            <select
              value={filterElement}
              onChange={(e) => setFilterElement(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Elements</option>
              {elementTypes.map((elem) => (
                <option key={elem} value={elem}>
                  {elem}
                </option>
              ))}
            </select>
          </div>

          {/* Measure Range Filter */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Measure Range
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={filterMeasureMin}
                onChange={(e) => setFilterMeasureMin(e.target.value)}
                placeholder="Min"
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-gray-500">—</span>
              <input
                type="number"
                value={filterMeasureMax}
                onChange={(e) => setFilterMeasureMax(e.target.value)}
                placeholder="Max"
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleReset}
                className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                title="Reset filters"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                onClick={() => handleSort('line')}
                className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center gap-1">
                  Line
                  {sortField === 'line' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th
                onClick={() => handleSort('measure')}
                className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center gap-1">
                  Measure
                  {sortField === 'measure' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Element
              </th>
              <th
                onClick={() => handleSort('exception_type')}
                className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
              >
                <div className="flex items-center gap-1">
                  Error Type
                  {sortField === 'exception_type' && (
                    <span className="text-blue-600">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Message
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedErrors.map((error, idx) => (
              <tr
                key={idx}
                onClick={() => onErrorClick?.(error)}
                className={`${
                  onErrorClick ? 'cursor-pointer hover:bg-blue-50' : ''
                } transition-colors`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                  {error.line ?? '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {error.measure ?? '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                  {error.element ?? '—'}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                    {error.exception_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 max-w-md truncate">
                  {error.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedErrors.length === 0 && (
        <div className="px-4 py-8 text-center text-gray-500">
          No errors match the current filters
        </div>
      )}

      {/* Footer */}
      {onErrorClick && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-600">
          💡 Click on an error row to jump to that location in the editor
        </div>
      )}
    </div>
  )
}
