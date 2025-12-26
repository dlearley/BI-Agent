{% macro weighted_forecast(values_column, weights_column, scenario_filter) %}
{# 
  Calculate weighted forecast values with scenario toggles
  Parameters:
    - values_column: column containing values to weight
    - weights_column: column containing weight factors
    - scenario_filter: boolean condition for scenario toggle
#}
  case 
    when {{ scenario_filter }} then
      sum({{ values_column }} * {{ weights_column }}) / 
      nullif(sum({{ weights_column }}), 0)
    else
      avg({{ values_column }})
  end
{% endmacro %}


{% macro scenario_toggle(column, scenario_enabled, true_value, false_value) %}
{#
  Toggle between two values based on scenario flag
  Parameters:
    - column: the column to potentially modify
    - scenario_enabled: boolean condition for scenario
    - true_value: value when scenario is enabled
    - false_value: value when scenario is disabled
#}
  case 
    when {{ scenario_enabled }} then {{ true_value }}
    else {{ false_value }}
  end
{% endmacro %}


{% macro weighted_pipeline_scenario(base_amount, win_probability, pipeline_stage_weight, apply_weighting) %}
{#
  Calculate weighted pipeline opportunity value
  Parameters:
    - base_amount: base opportunity amount
    - win_probability: probability of winning (0-1)
    - pipeline_stage_weight: weight factor for pipeline stage
    - apply_weighting: boolean to enable weighted calculation
#}
  case 
    when {{ apply_weighting }} then
      {{ base_amount }} * {{ win_probability }} * {{ pipeline_stage_weight }}
    else
      {{ base_amount }} * {{ win_probability }}
  end
{% endmacro %}
