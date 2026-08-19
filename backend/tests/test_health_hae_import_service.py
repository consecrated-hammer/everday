from datetime import date

from app.modules.health.services import hae_import_service as service


def test_parse_workout_handles_common_health_auto_export_shape():
    parsed = service._ParseWorkout(  # noqa: SLF001
        {
            "id": "workout-123",
            "name": "Outdoor Run",
            "workoutActivityType": "running",
            "startDate": "2026-07-16T06:15:00Z",
            "endDate": "2026-07-16T06:55:00Z",
            "duration": 2400,
            "durationUnit": "seconds",
            "activeEnergyBurned": 430,
            "distance": 8.2,
            "distanceUnit": "km",
        }
    )

    assert parsed is not None
    assert parsed.WorkoutType == "running"
    assert parsed.WorkoutName == "Outdoor Run"
    assert parsed.CaloriesBurned == 430
    assert parsed.DurationMinutes == 40.0
    assert parsed.DistanceKm == 8.2
    assert parsed.ExternalId == "workout-123"
    assert parsed.LogDate.isoformat() == "2026-07-16"


def test_parse_workout_converts_distance_and_duration_units():
    parsed = service._ParseWorkout(  # noqa: SLF001
        {
            "uuid": "workout-456",
            "activityType": "walking",
            "title": "Evening Walk",
            "date": "2026-07-15T18:00:00+00:00",
            "durationMinutes": 3600,
            "durationUnit": "seconds",
            "calories": 210,
            "distance": 3200,
            "distanceUnit": "meters",
        }
    )

    assert parsed is not None
    assert parsed.WorkoutType == "walking"
    assert parsed.WorkoutName == "Evening Walk"
    assert parsed.DurationMinutes == 60.0
    assert parsed.DistanceKm == 3.2
    assert parsed.CaloriesBurned == 210


def test_parse_metrics_extracts_sleep_analysis_total_sleep():
    entries, latest_steps, latest_weight, latest_sleep, latest_resting_heart_rate = service._ParseMetrics(  # noqa: SLF001
        [
            {
                "name": "sleep_analysis",
                "units": "hr",
                "data": [
                    {
                        "date": "2026-07-19 00:00:00 +0930",
                        "totalSleep": 6.630371916029189,
                        "asleep": 0,
                        "sleepStart": "2026-07-18 23:09:44 +0930",
                        "sleepEnd": "2026-07-19 05:58:29 +0930",
                    }
                ],
            }
        ]
    )

    assert latest_steps == {}
    assert latest_weight == {}
    assert latest_resting_heart_rate == {}
    assert len(entries) == 1
    # LogDate follows sleepStart (bedtime day: Jul 18), not HAE's own "date" field
    # (wake day: Jul 19) or sleepEnd. OccurredAt still reflects when sleep concluded.
    sleep_entry = latest_sleep[date(2026, 7, 18)]
    assert sleep_entry.MetricType == "sleep"
    assert sleep_entry.LogDate.isoformat() == "2026-07-18"
    assert sleep_entry.Value == 6.63
    assert sleep_entry.OccurredAt.isoformat() == "2026-07-18T20:28:29+00:00"


def test_parse_metrics_sleep_falls_back_to_date_field_without_sleep_start():
    entries, _latest_steps, _latest_weight, latest_sleep, _latest_resting_heart_rate = service._ParseMetrics(  # noqa: SLF001
        [
            {
                "name": "sleep_analysis",
                "units": "hr",
                "data": [
                    {
                        "date": "2026-07-19 00:00:00 +0930",
                        "totalSleep": 6.5,
                        "sleepEnd": "2026-07-19 05:58:29 +0930",
                    }
                ],
            }
        ]
    )

    assert len(entries) == 1
    sleep_entry = latest_sleep[date(2026, 7, 19)]
    assert sleep_entry.LogDate.isoformat() == "2026-07-19"
    assert sleep_entry.OccurredAt.isoformat() == "2026-07-18T20:28:29+00:00"


def test_parse_metrics_averages_resting_heart_rate_by_day():
    entries, latest_steps, latest_weight, latest_sleep, latest_resting_heart_rate = service._ParseMetrics(  # noqa: SLF001
        [
            {
                "name": "resting_heart_rate",
                "units": "count/min",
                "data": [
                    {"date": "2026-07-19T07:00:00Z", "qty": 60},
                    {"date": "2026-07-19T08:00:00Z", "qty": 62},
                ],
            }
        ]
    )

    assert latest_steps == {}
    assert latest_weight == {}
    assert latest_sleep == {}
    assert len(entries) == 2
    heart_rate = latest_resting_heart_rate[date(2026, 7, 19)]
    assert heart_rate.MetricType == "resting_heart_rate"
    assert heart_rate.Value == 61
    assert heart_rate.OccurredAt.isoformat() == "2026-07-19T08:00:00+00:00"
