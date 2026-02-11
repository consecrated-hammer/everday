import SwiftUI

struct SettingsAppearanceView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @AppStorage("everday.appearance.theme") private var appearanceTheme = "system"
    @AppStorage("everday.appearance.showDecimals") private var showDecimals = true

    var body: some View {
        let listView = Form {
            Section("Theme") {
                Picker("Theme", selection: $appearanceTheme) {
                    Text("System").tag("system")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }
                .pickerStyle(.segmented)
                Text("Theme follows your selection for this device.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Numbers") {
                Toggle("Show decimals in currency", isOn: $showDecimals)
                Text("Disable decimals for cleaner totals in budget views.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Icons") {
                HStack {
                    Text("Icon style")
                    Spacer()
                    Text("SF Symbols")
                        .foregroundStyle(.secondary)
                }
                Text("iOS uses the system icon set for consistent native visuals.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }

        Group {
            if horizontalSizeClass == .regular {
                listView
                    .frame(maxWidth: 720)
                    .frame(maxWidth: .infinity)
            } else {
                listView
            }
        }
        .navigationTitle("Appearance")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Appearance")
                }
            }
        }
    }
}
