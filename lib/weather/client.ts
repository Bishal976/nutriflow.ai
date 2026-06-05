export interface WeatherData {
  tempC: number
  humidity: number
  heatIndex: number
  condition: string
  city?: string
}

// Open-Meteo — free, no API key required
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=auto`

  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Weather API error: ${res.status}`)

  const data = await res.json()
  const c = data.current

  return {
    tempC: Math.round(c.temperature_2m),
    humidity: c.relative_humidity_2m,
    heatIndex: Math.round(c.apparent_temperature),
    condition: weatherCodeToCondition(c.weather_code),
  }
}

// Default to New Delhi if no coordinates
export async function fetchWeatherByCity(city: string, country: string): Promise<WeatherData> {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    )
    const geoData = await geo.json()
    if (!geoData.results?.length) throw new Error('City not found')
    const { latitude, longitude } = geoData.results[0]
    const weather = await fetchWeather(latitude, longitude)
    return { ...weather, city }
  } catch {
    // Fallback: return seasonal average based on common regions
    return { tempC: 28, humidity: 65, heatIndex: 30, condition: 'partly_cloudy', city }
  }
}

function weatherCodeToCondition(code: number): string {
  if (code === 0) return 'clear'
  if (code <= 3) return 'partly_cloudy'
  if (code <= 49) return 'foggy'
  if (code <= 67) return 'rainy'
  if (code <= 77) return 'snowy'
  if (code <= 82) return 'rainy'
  return 'stormy'
}
