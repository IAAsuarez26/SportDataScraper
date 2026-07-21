# UCL Squad Analyzer

## UEFA Champions League Squad Analysis Application

Aplicación web integral para analizar la situación actual de las plantillas de los **36 clubes** participantes en la UEFA Champions League 2025/26, proporcionando análisis detallado de forma física, técnica y táctica para predecir qué equipos llegan en mejor condición para sus próximos partidos.

![UCL Squad Analyzer](https://img.shields.io/badge/UCL-Squad%20Analyzer-1a5fc9?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQxIDAtOC0zLjU5LTgtOHMzLjU5LTggOC04IDggMy41OSA4IDgtMy41OSA4LTggOHoiLz48L3N2Zz4=)

## 🚀 Características

### Dashboard Principal
- Ranking de equipos por puntuación de forma total
- Estadísticas promedio de todos los equipos
- Gráficos interactivos de distribución

### Análisis de Equipos
- **Forma Física**: Lesiones, fatiga, días de descanso
- **Forma Técnica**: Goles, xG, posesión, precisión de pases
- **Forma Táctica**: Formaciones, rendimiento casa/fuera, consistencia

### Comparador de Equipos
- Comparación head-to-head entre 2 equipos
- Gráfico radar con todas las métricas
- Predicción de favorito con probabilidades

### Predicciones de Partidos
- Lista de próximos fixtures
- Predicción basada en análisis de forma
- Nivel de confianza por partido

## 📦 Estructura del Proyecto

```
InputsChampions/
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── requirements.txt        # Dependencias Python
│   ├── scrapers/
│   │   ├── base_scraper.py     # Clase base de scrapers
│   │   ├── uefa_scraper.py     # Scraper UEFA.com
│   │   ├── sofascore_scraper.py # Scraper SofaScore
│   │   ├── espn_scraper.py     # Scraper ESPN
│   │   └── aggregator.py       # Agregador multi-fuente
│   ├── analysis/
│   │   ├── physical_analyzer.py
│   │   ├── technical_analyzer.py
│   │   ├── tactical_analyzer.py
│   │   ├── composite_scorer.py
│   │   └── predictor.py
│   ├── models/
│   │   ├── team.py
│   │   └── player.py
│   └── data/
│       └── cache/              # Datos cacheados
├── frontend/
│   ├── index.html
│   ├── styles/
│   │   └── main.css
│   └── scripts/
│       ├── api.js
│       ├── charts.js
│       └── app.js
└── README.md
```

## 🛠️ Instalación

### Requisitos
- Python 3.11+
- Node.js (opcional, para servidor de desarrollo frontend)

### Backend

```bash
# Navegar al directorio backend
cd backend

# Crear entorno virtual (recomendado)
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Ejecutar servidor
python -m uvicorn main:app --reload --port 8000
```

### Frontend

El frontend es HTML/CSS/JS puro y puede servirse de varias formas:

**Opción 1: Servidor Python simple**
```bash
cd frontend
python -m http.server 3000
```

**Opción 2: Live Server de VS Code**
Abrir `frontend/index.html` con la extensión Live Server.

**Opción 3: Directamente en el navegador**
Abrir `frontend/index.html` directamente (algunas funcionalidades pueden limitarse por CORS).

## 🔌 API Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/teams` | GET | Lista todos los equipos |
| `/api/teams/{team_id}` | GET | Detalle de un equipo |
| `/api/rankings` | GET | Rankings por forma |
| `/api/fixtures` | GET | Próximos partidos |
| `/api/compare` | POST | Comparar equipos |
| `/api/predict` | POST | Predecir partido |
| `/api/refresh` | POST | Actualizar datos |

## 📊 Fuentes de Datos

- **UEFA.com** - Fixtures, standings, información de equipos
- **SofaScore** - Estadísticas avanzadas, xG, ratings
- **ESPN** - Tabla, noticias, injury reports

## ⚙️ Configuración

### Variables de Entorno (opcional)

Crear archivo `.env` en la carpeta `backend/`:

```env
# Cache settings
CACHE_DURATION_HOURS=6

# Rate limiting
REQUEST_DELAY_SECONDS=1.0
```

## 📱 Capturas de Pantalla

La aplicación cuenta con:
- Tema oscuro moderno con efectos de glassmorphism
- Diseño responsive para móviles y tablets
- Animaciones suaves y micro-interacciones
- Gráficos interactivos con Chart.js

## 🤝 Contribuir

1. Fork el repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📄 Licencia

Este proyecto es de uso educativo y personal. Los datos son obtenidos de fuentes públicas.

---

**Desarrollado con ❤️ para análisis de la UEFA Champions League**
