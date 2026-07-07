> **⚠️ LEGAL NOTICE:** This repository is proprietary. Viewing is permitted; copying, redistribution, or use of this code without explicit written permission is strictly prohibited.

# NutriFlow AI

Adaptive, condition-aware nutrition planning — deterministic calorie/macro targets, AI-generated meal plans, and safety-validated dietary restrictions personalized to each user's onboarding data (demographics, goals, medical conditions, diet type, and location).

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Roadmap

### Phase 2

Prioritized for the next development cycle, post-launch.

#### 1. Surface micronutrient targets on the dashboard

Sodium, potassium, phosphorus, iron, and calcium are already computed correctly per user — condition-aware, e.g. hypertension caps sodium at 1500mg, anemia raises iron — and persisted in `nutrition_targets`. However, `/api/plan/generate` never returns them and the dashboard never displays them. A user managing a sodium- or potassium-sensitive condition currently has no visibility into the number actually driving their meal-generation restrictions.

- **Scope:** extend the `/api/plan/generate` response with the existing micronutrient fields; add a corresponding section to the dashboard's "Daily targets" card.
- **Effort:** small — the computation and storage already exist; this is an API contract + UI display change only.

#### 2. Full micronutrient tracking (vitamins, minerals) alongside macros

Expand beyond today's macro (calories/protein/carbs/fat) + 5-micronutrient model to track the full standard set — vitamin A/C/D/E/K, B-complex, magnesium, zinc, and others — against RDA/RDI targets, adjusted per user condition the same way sodium/potassium restrictions work today.

- **This is a product decision, not just an engineering task.** Before committing build time, validate:
  - Do users actually want this level of granularity, or does it add clutter without added perceived value?
  - Should this sit behind the **Pro** upgrade as a differentiator, or does making it free drive more signups/retention and pay off through volume instead?
- **Recommendation:** run a lightweight market validation pass — user survey, competitor feature-gating research, or a cheap prototype/waitlist test — before scoping the full nutrient-tracking pipeline (new schema, condition-aware target logic, AI prompt changes, UI). Decide the free-vs-paid question with that data in hand, not upfront.

#### 3. Internationalization (i18n)

The app is currently English-only and India-centric (cuisine list, city picker, units). Full i18n covers:

- UI string translation and locale switching
- Locale-aware units (metric ⇄ imperial for height/weight/water)
- Broadening the cuisine and location presets beyond the current Indian-city set

#### 4. Google OAuth sign-in

Add "Sign in with Google" alongside the existing email/password flow to reduce signup friction.
