import SwiftUI

struct HealthHistoryDayView: View {
    let dateKey: String
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""
    @State private var logResponse: HealthDailyLogResponse?
    @State private var foods: [HealthFood] = []
    @State private var templates: [HealthMealTemplateWithItems] = []
    @State private var shareUsers: [SettingsUser] = []
    @State private var editingEntry: HealthMealEntryWithFood?
    @State private var showEntrySheet = false
    @State private var entryToDelete: HealthMealEntryWithFood?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                headerCard

                ForEach(mealOrder, id: \.self) { meal in
                    mealSection(meal)
                }

                if status == .loading {
                    HealthEmptyState(message: "Loading day...")
                }

                if !errorMessage.isEmpty {
                    HealthErrorBanner(message: errorMessage)
                }
            }
            .padding(20)
            .frame(maxWidth: 860)
            .frame(maxWidth: .infinity)
        }
        .sheet(isPresented: $showEntrySheet) {
            HealthMealEntrySheet(
                logDate: dateKey,
                dailyLogId: logResponse?.DailyLog?.DailyLogId,
                initialMealType: .Breakfast,
                existingEntry: editingEntry,
                foods: foods,
                templates: templates,
                shareUsers: shareUsers,
                nextSortOrder: nextSortOrder,
                onSaved: { Task { await load() } }
            )
        }
        .alert("Delete entry", isPresented: Binding(
            get: { entryToDelete != nil },
            set: { if !$0 { entryToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let entry = entryToDelete {
                    Task { await deleteEntry(entry) }
                }
            }
            Button("Cancel", role: .cancel) { entryToDelete = nil }
        } message: {
            Text("This will remove the entry from the log.")
        }
        .navigationTitle(HealthFormatters.formatLongDate(dateKey))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if status == .idle {
                await load()
            }
        }
    }

    private var headerCard: some View {
        HealthSectionCard {
            HealthSectionHeader(
                title: "Day summary",
                subtitle: "\(entryCount) entries | \(totalCaloriesLabel)",
                trailing: AnyView(
                    Button("Add entry") {
                        editingEntry = nil
                        showEntrySheet = true
                    }
                    .buttonStyle(.borderedProminent)
                )
            )
        }
    }

    private var entryCount: Int {
        logResponse?.Entries.count ?? 0
    }

    private var totalCaloriesLabel: String {
        let total = logResponse?.Summary.TotalCalories ?? logResponse?.Entries.reduce(0) { $0 + ($1.CaloriesPerServing * $1.Quantity) } ?? 0
        return "\(Int(total.rounded())) kcal"
    }

    private var mealOrder: [HealthMealType] {
        [.Breakfast, .Snack1, .Lunch, .Snack2, .Dinner, .Snack3]
    }

    private var groupedEntries: [HealthMealType: [HealthMealEntryWithFood]] {
        let entries = logResponse?.Entries ?? []
        let sorted = entries.sorted { $0.SortOrder < $1.SortOrder }
        return Dictionary(grouping: sorted, by: { $0.MealType })
    }

    private var nextSortOrder: Int {
        let entries = logResponse?.Entries ?? []
        let maxValue = entries.map { $0.SortOrder }.max() ?? 0
        return maxValue + 1
    }

    private func mealSection(_ meal: HealthMealType) -> some View {
        let entries = groupedEntries[meal] ?? []
        return HealthSectionCard {
            HealthSectionHeader(title: meal.label, subtitle: entries.isEmpty ? "No entries" : "\(entries.count) items")
            if entries.isEmpty {
                HealthEmptyState(message: "Nothing logged yet.")
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(entries) { entry in
                        HealthEntryRow(entry: entry) {
                            editingEntry = entry
                            showEntrySheet = true
                        } onDelete: {
                            entryToDelete = entry
                        }
                    }
                }
            }
        }
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            async let logResult = HealthApi.fetchDailyLog(date: dateKey)
            if foods.isEmpty {
                foods = try await HealthApi.fetchFoods()
            }
            if templates.isEmpty {
                let response = try await HealthApi.fetchMealTemplates()
                templates = response.Templates
            }
            if shareUsers.isEmpty {
                do {
                    shareUsers = try await SettingsApi.fetchUsers()
                } catch {
                    shareUsers = []
                }
            }
            logResponse = try await logResult
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to load day."
        }
    }

    private func deleteEntry(_ entry: HealthMealEntryWithFood) async {
        entryToDelete = nil
        do {
            status = .loading
            _ = try await HealthApi.deleteMealEntry(mealEntryId: entry.MealEntryId)
            await load()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Unable to delete entry."
        }
    }
}

private struct HealthEntryRow: View {
    let entry: HealthMealEntryWithFood
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.TemplateName ?? entry.FoodName)
                    .font(.subheadline.weight(.semibold))
                Text(detailLine)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 6) {
                Text(HealthFormatters.formatCalories(entry.CaloriesPerServing * entry.Quantity))
                    .font(.subheadline.weight(.semibold))
                HStack(spacing: 8) {
                    Button(action: onEdit) {
                        Image(systemName: "pencil")
                    }
                    .buttonStyle(.borderless)

                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.borderless)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var detailLine: String {
        let quantity = HealthFormatters.formatNumber(entry.Quantity, decimals: 2)
        let unit = entry.PortionLabel ?? "serving"
        return "\(quantity) \(unit)"
    }
}

private enum LoadState {
    case idle
    case loading
    case ready
    case error
}
