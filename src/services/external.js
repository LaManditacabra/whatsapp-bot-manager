import axios from 'axios';
import config from '../config/index.js';
import logger from '../utils/logger.js';

export async function getWeather(city = 'Montevideo') {
  if (!config.apis.weather) {
    return 'API de clima no configurada. Configura WEATHER_API_KEY en .env';
  }
  try {
    const { data } = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          q: city,
          appid: config.apis.weather,
          units: 'metric',
          lang: 'es',
        },
      },
    );
    const t = data.main;
    return [
      `*🌤 Clima en ${data.name}*`,
      `Temperatura: ${t.temp}°C (mín ${t.temp_min}°C / máx ${t.temp_max}°C)`,
      `Sensación: ${t.feels_like}°C`,
      `Humedad: ${t.humidity}%`,
      `Descripción: ${data.weather[0].description}`,
    ].join('\n');
  } catch (err) {
    logger.error({ err }, 'Error obteniendo clima');
    return 'No pude obtener el clima en este momento.';
  }
}

export async function getNews() {
  if (!config.apis.news) {
    return 'API de noticias no configurada. Configura NEWS_API_KEY en .env';
  }
  try {
    const { data } = await axios.get(
      `https://newsapi.org/v2/top-headlines`,
      {
        params: {
          country: 'us',
          apiKey: config.apis.news,
          pageSize: 5,
        },
      },
    );
    const articles = data.articles
      .map((a, i) => `${i + 1}. *${a.title}*\n   ${a.description || ''}`)
      .join('\n\n');
    return `*📰 Últimas noticias*\n\n${articles}`;
  } catch (err) {
    logger.error({ err }, 'Error obteniendo noticias');
    return 'No pude obtener las noticias en este momento.';
  }
}
