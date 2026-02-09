import SwiftUI

struct LifeAdminRootView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selection: LifeAdminTab = .records

    var body: some View {
        VStack(spacing: 12) {
            Picker("Life admin section", selection: $selection) {
                ForEach(LifeAdminTab.allCases) { tab in
                    Text(tab.label).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.top, 12)

            Group {
                switch selection {
                case .records:
                    LifeAdminRecordsView()
                case .library:
                    LifeAdminLibraryView()
                case .builder:
                    LifeAdminBuilderView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Life admin")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Life admin")
                }
            }
        }
    }
}

private enum LifeAdminTab: String, CaseIterable, Identifiable {
    case records
    case library
    case builder

    var id: String { rawValue }

    var label: String {
        switch self {
        case .records:
            return "Records"
        case .library:
            return "Library"
        case .builder:
            return "Builder"
        }
    }
}
