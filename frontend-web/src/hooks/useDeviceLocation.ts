import { useCallback, useState } from 'react'

type DeviceLocation = {
  lat: number
  lng: number
  accuracy?: number
}

export function useDeviceLocation() {
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = useCallback(() => {
    setError(null)

    if (!('geolocation' in navigator)) {
      const unsupported = 'Device location is not available in this browser.'
      setError(unsupported)
      return Promise.reject(new Error(unsupported))
    }

    setIsLocating(true)
    return new Promise<DeviceLocation>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const nextLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }
          setLocation(nextLocation)
          setIsLocating(false)
          resolve(nextLocation)
        },
        geoError => {
          const message = geoError.message || 'Could not read device location.'
          setError(message)
          setIsLocating(false)
          reject(new Error(message))
        },
        { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 },
      )
    })
  }, [])

  return { location, isLocating, error, requestLocation }
}
