import React from 'react';
import type { JSX } from 'react';

export default function MethodologyDetails(): JSX.Element {
  return (
    <section>
      <h2>How the model works</h2>
      <details open>
        <summary>Metabolic rate during very-low-calorie dieting</summary>
        <p>
          Basal metabolic rate is calculated with the Mifflin–St Jeor equation and then adjusted for metabolic slowdown that
          accumulates as substantial weight is lost. Extremely low caloric intakes trigger an additional reduction to reflect
          the adaptive thermogenesis that appears in prolonged VLCD protocols.
        </p>
      </details>
      <details>
        <summary>Why the first week can fall faster</summary>
        <p>
          The simulator now carries a transient glycogen-and-fluid store that depletes quickly when carbohydrates are scarce
          and energy deficits exceed roughly 1,000 kilocalories per day. Research on very-low-calorie diets shows that liver
          and muscle glycogen can shrink by two to three kilograms of hydrated mass during the first several days, especially
          when intake stays below 900 kcal. The projection mirrors that front-loaded drop, so aggressive plans will forecast a
          slightly faster scale response before settling into the slower, tissue-driven trend.
        </p>
      </details>
      <details>
        <summary>Water weight & glycogen forecasting</summary>
        <p>
          Two weight curves are produced. The fasted curve assumes glycogen remains suppressed from continuous energy deficit,
          so only a fraction of the normal hydration buffer is present. The refed curve restores the full glycogen-bound water,
          approximating the number you would see after a week at maintenance calories.
        </p>
      </details>
      <details>
        <summary>Activity and energy expenditure</summary>
        <p>
          Activity factors default to low multipliers that mirror reduced spontaneous movement on VLCDs. You can override
          individual days to model hikes, climbing sessions, or other training bouts. The resulting total energy expenditure is
          recalculated day-by-day and ripples through subsequent predictions.
        </p>
      </details>
    </section>
  );
}
