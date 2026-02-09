import SwiftUI

struct BudgetRootView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selection: BudgetTab = .allocations

    var body: some View {
        VStack(spacing: 12) {
            Picker("Budget section", selection: $selection) {
                ForEach(BudgetTab.allCases) { tab in
                    Text(tab.label).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 12)

            Group {
                switch selection {
                case .allocations:
                    BudgetAllocationsView()
                case .expenses:
                    BudgetExpensesView()
                case .income:
                    BudgetIncomeView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Budget")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Budget")
                }
            }
        }
    }
}

private enum BudgetTab: String, CaseIterable, Identifiable {
    case allocations
    case expenses
    case income

    var id: String { rawValue }

    var label: String {
        switch self {
        case .allocations:
            return "Allocations"
        case .expenses:
            return "Expenses"
        case .income:
            return "Income"
        }
    }
}
