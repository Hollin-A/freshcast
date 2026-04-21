import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { getWeekSummary, getTopProducts } from "./analytics";
import { predictNextWeek } from "./prediction-engine";

export async function buildWeeklySummaryEmail(businessId: string): Promise<string | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!business || !business.weeklyEmailEnabled) return null;

  const { timezone, region } = business;
  const [weekSummary, topProducts, weeklyForecast] = await Promise.all([
    getWeekSummary(businessId, timezone),
    getTopProducts(businessId, timezone, 5),
    predictNextWeek(businessId, timezone, region).catch(() => null),
  ]);

  const changeDir = weekSummary.changePercent > 0 ? "up" : weekSummary.changePercent < 0 ? "down" : "flat";
  const changeAbs = Math.abs(weekSummary.changePercent);

  // Top products rows
  const productRows = topProducts
    .map((p) => `
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #1E1A14; border-bottom: 1px solid #E4D9C1;">${p.product}</td>
        <td style="padding: 8px 0; font-size: 14px; color: #3B342A; text-align: right; font-family: monospace; border-bottom: 1px solid #E4D9C1;">${p.totalQuantity} ${p.unit || "units"}</td>
      </tr>
    `)
    .join("");

  // Forecast rows
  let forecastSection = "";
  if (weeklyForecast && weeklyForecast.length > 0) {
    const forecastRows = weeklyForecast
      .slice(0, 3)
      .map((p) => {
        const total = p.daily.reduce((s, d) => s + d.predictedQuantity, 0);
        return `
          <tr>
            <td style="padding: 8px 0; font-size: 14px; color: #1E1A14; border-bottom: 1px solid #E4D9C1;">${p.product}</td>
            <td style="padding: 8px 0; font-size: 14px; color: #3B342A; text-align: right; font-family: monospace; border-bottom: 1px solid #E4D9C1;">~${total} ${p.unit || "units"}</td>
          </tr>
        `;
      })
      .join("");

    forecastSection = `
      <div style="margin-top: 28px;">
        <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #7A6F5E; margin-bottom: 12px;">Next week forecast</p>
        <table style="width: 100%; border-collapse: collapse;">${forecastRows}</table>
      </div>
    `;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; background: #FAF6EC;">
      <h2 style="color: #B5553A; font-size: 22px; margin-bottom: 4px; font-weight: 600;">Freshcast</h2>
      <p style="color: #7A6F5E; font-size: 13px; margin-bottom: 24px;">Weekly summary for ${business.name}</p>

      <div style="background: #1E1A14; border-radius: 16px; padding: 24px; color: #F5EFE3; margin-bottom: 20px;">
        <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #D48A5E; margin-bottom: 8px;">This week</p>
        <p style="font-size: 32px; font-weight: 500; margin: 0; letter-spacing: -1px;">${Math.round(weekSummary.totalQuantity)} units</p>
        <p style="font-size: 14px; color: rgba(245,239,227,0.6); margin-top: 4px;">
          ${changeDir === "flat" ? "Same as last week" : `${changeDir === "up" ? "↑" : "↓"} ${changeAbs}% vs last week`}
        </p>
      </div>

      <p style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #7A6F5E; margin-bottom: 12px;">Top products</p>
      <table style="width: 100%; border-collapse: collapse;">${productRows}</table>

      ${forecastSection}

      <p style="color: #7A6F5E; font-size: 13px; font-style: italic; text-align: center; margin-top: 32px; line-height: 1.5;">
        Your data is private.<br/>Freshcast only works for your business.
      </p>
      <p style="color: #A89B85; font-size: 12px; margin-top: 24px; border-top: 1px solid #E4D9C1; padding-top: 16px; text-align: center;">
        Freshcast — Sales tracking for small businesses
      </p>
    </div>
  `;

  return html;
}

export async function sendWeeklySummary(businessId: string): Promise<boolean> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { user: { select: { email: true } } },
    });

    if (!business || !business.weeklyEmailEnabled || !business.user.email) {
      return false;
    }

    const html = await buildWeeklySummaryEmail(businessId);
    if (!html) return false;

    const sent = await sendEmail(
      business.user.email,
      `Freshcast — Your week at ${business.name}`,
      html
    );

    if (sent) {
      logger.info("email", "Weekly summary sent", { businessId, email: business.user.email });
    }
    return sent;
  } catch (err) {
    logger.error("email", "Failed to send weekly summary", { businessId, error: err });
    return false;
  }
}
