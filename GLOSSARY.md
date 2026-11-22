# Freshcast

Freshcast helps small fresh-goods vendors log sales and forecast tomorrow's prep. This glossary fixes the words used for the product's domain, its surfaces and its presentation.

## Domain

### People

**Vendor**:
The person who runs a Business and uses the App to log sales and plan prep.
_Avoid_: business owner, merchant, customer, user

**Business**:
The shop, stall or café a Vendor logs sales for. Each Business's data is visible only to its own Vendor.
_Avoid_: store, account, tenant, organisation

**Demo account**:
The seeded Business anyone can sign in to with the published demo login to try the App. It can't be deleted and its password can't be changed.
_Avoid_: test account, guest account

### Selling

**Product**:
Something a Business sells and logs quantities of, such as eggs or beef mince.
_Avoid_: item, SKU, catalogue entry

**Sales entry**:
One act of logging sales for a date. It holds one or more Sales items, and a Business can make several in a day.
_Avoid_: sale, transaction, order, log entry

**Business date**:
A calendar date as it is where the Business trades, in the Business's timezone. A Sales entry's date, "today", "tomorrow" and every week or window are Business dates, so two Businesses can be on different dates at the same moment.
_Avoid_: local date, server date, UTC date

**Sales item**:
One line of a Sales entry: a Product and the quantity sold.
_Avoid_: line item, sale

**Input method**:
The way a Vendor makes a Sales entry. There are three: Natural language, Manual form and Receipt photo.
_Avoid_: input mode, entry type

**Natural language**:
The Input method where the Vendor types a sentence, such as "sold 20 eggs, 30kg beef", and confirms what Freshcast read from it.
_Avoid_: NL input, free text, smart input

**Manual form**:
The Input method where the Vendor enters a quantity against each Product in a list.
_Avoid_: form input, quick entry

**Receipt photo**:
The Input method where the Vendor photographs a supplier or POS receipt and confirms the Sales items read from it.
_Avoid_: receipt scan, OCR input, receipt upload

### Forecasting

**Forecast**:
The expected quantity of one Product on one future day, with a confidence.
_Avoid_: prediction, projection, estimate

**Next-day forecast**:
The Forecasts for tomorrow, shown first because Vendors prep the night before.
_Avoid_: tomorrow's prediction, daily forecast

**Week-ahead forecast**:
The Forecasts for each of the next seven days.
_Avoid_: weekly prediction, weekly forecast

**Demand spike**:
A Forecast well above that Product's usual demand, flagged so the Vendor preps more.
_Avoid_: spike alert, surge

**Forecast readiness**:
How much sales history a Business has logged towards Forecasts appearing and becoming reliable.
_Avoid_: prediction progress, data progress

**Region**:
The area a Business trades in, which decides the public holidays that adjust its Forecasts.
_Avoid_: locale (that is the language setting), country, location

### Understanding sales

**Sales history**:
A Business's Sales items totalled over a window of Business dates, per Product and per day. Insights, Chat and the Weekly summary read it.
_Avoid_: analytics, sales summary, aggregates

**Insight**:
A short generated observation about a Business's recent sales, such as "Friday is your strongest day".
_Avoid_: tip, AI insight, summary

**Chat**:
Questions a Vendor asks about their own Business's sales, answered in conversation.
_Avoid_: AI chat, assistant, chatbot

**Weekly summary**:
The opt-in email that recaps a Business's past week and its Week-ahead forecast.
_Avoid_: weekly email, digest, newsletter

## Surfaces

**App**:
The signed-in product where a Vendor logs sales, sees Forecasts and uses Chat. Served at `app.freshcast.site` after the domain cutover.
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
