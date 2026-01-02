from app.modules.health.schemas import Targets

DefaultTargets = Targets(
    DailyCalorieTarget=1498,
    ProteinTargetMin=70,
    ProteinTargetMax=188,
    StepKcalFactor=0.04,
    StepTarget=8500,
)

DefaultTodayLayout = ["snapshot", "checkins", "quickadd"]

DefaultFoods: list[tuple[str, str, int, float]] = [
    ("Coffee With Sugar And Light Milk", "1 cup", 70, 2),
    ("Sanitarium Weet-Bix", "1 biscuit (16 g)", 64, 2.7),
    ("Coles Light Milk", "1/2 cup (125 ml)", 44, 4.3),
    ("Coffee - Moccona Classic No 8 Dark Roast", "1 tbsp (6 g)", 0, 0),
    ("Raw Sugar", "1 tsp (4 g)", 16, 0),
    ("Woolworths Garden Salad Bowl", "180 g", 211, 2.7),
    ("Woolworths Chicken Breast Bites Karaage", "4 pieces (793 kJ)", 189, 15.5),
    ("Pink Lady Apple", "1 medium (150 g)", 100, 0.5),
    ("Bega Crunchy Peanut Butter", "1 tbsp (16 g)", 94, 3.6),
    ("Coca-Cola Zero Sugar", "1 can (375 ml)", 1, 0),
]
