import { useEffect, useState } from 'react'
import { Facility } from '../types'
import { fetchFacilities } from '../lib/database'

export function useFacilities() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetchFacilities().then(data => { if (active) setFacilities(data) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load facilities.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return { facilities, loading, error }
}
