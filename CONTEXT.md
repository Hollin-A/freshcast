# Freshcast

Freshcast helps small fresh-goods vendors log sales and forecast tomorrow's prep. This glossary fixes the words used for the product's surfaces and presentation.

## Surfaces

**App**:
The signed-in product where a vendor logs sales, sees forecasts and chats with the assistant. Served at `app.freshcast.site` after the domain cutover.
_Avoid_: dashboard (that is one page of the App), web app, PWA (the App is installable, but that is a delivery detail)

**Landing site**:
The public marketing site that introduces Freshcast and links into the App. Served at the root domain `freshcast.site`.
_Avoid_: homepage, marketing page, website

**API**:
The backend service the App calls for all data, served at `api.freshcast.site`. It replaces the Legacy API one domain at a time.
_Avoid_: server, backend (when the API specifically is meant)

**Legacy API**:
The backend built into the App, which the API is replacing. A Legacy API route is deleted once the App no longer calls it.
_Avoid_: old API, Next.js API, API routes (when the Legacy API as a whole is meant)

## Presentation

**Brand**:
The visual identity shared by the App and the Landing site: palette, typography, logo, icons and chart colours.
_Avoid_: theme (overloaded with Appearance)

**Appearance**:
A viewer's choice of light, dark or system colours. Each Appearance is a rendering of the same Brand.
_Avoid_: theme, dark mode (as the name of the setting)
