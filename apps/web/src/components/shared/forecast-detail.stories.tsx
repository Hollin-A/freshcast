import { fn } from "storybook/test";
import preview from "#.storybook/preview";
import { fixtureDate } from "@/test/msw/fixtures/types";
import { ForecastDetail } from "./forecast-detail";

const days = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"];

const meta = preview.meta({
  component: ForecastDetail,
  parameters: { layout: "fullscreen" },
  args: {
    product: "Lamb chops",
    predictedQuantity: 22,
    unit: "portions",
    confidence: 0.82,
    forecastDate: fixtureDate(1),
    weeklyData: {
      daily: [22, 19, 24, 30, 34, 27, 18].map((predictedQuantity, i) => ({
        date: fixtureDate(i + 1),
        dayOfWeek: days[i],
        predictedQuantity,
      })),
    },
    pastWeek: [17, 21, 20, 26, 31, 25, 16],
    breakdown: { weekdayAvg: 23, recentAvg: 21, holidayMultiplier: 1 },
    dataPoints: 14,
    onClose: fn(),
  },
});

export const Default = meta.story();

export const HolidayAdjusted = meta.story({
  args: { breakdown: { weekdayAvg: 23, recentAvg: 21, holidayMultiplier: 1.25 } },
});

// A new business with no sales history yet: no chart, buffer from the
// forecast alone.
export const WithoutHistory = meta.story({
  args: { weeklyData: undefined, pastWeek: undefined, breakdown: undefined, dataPoints: undefined },
});
