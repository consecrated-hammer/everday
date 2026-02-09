import SwiftUI

struct DashboardView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                DashboardCard(
                    title: "Health",
                    subtitle: "Track your health profile and insights",
                    systemImage: "heart.text.square",
                    destination: HealthRootView()
                )

                DashboardCard(
                    title: "Budget",
                    subtitle: "Plan income, expenses, and allocations",
                    systemImage: "chart.pie.fill",
                    destination: BudgetRootView()
                )

                DashboardCard(
                    title: "Life Admin",
                    subtitle: "Manage records, library, and builder",
                    systemImage: "folder.fill",
                    destination: LifeAdminRootView()
                )

                DashboardCard(
                    title: "Kids Admin",
                    subtitle: "Manage schedules, tasks, and permissions",
                    systemImage: "person.2.fill",
                    destination: KidsAdminView()
                )

                DashboardCard(
                    title: "Shopping",
                    subtitle: "Manage shared grocery lists",
                    systemImage: "cart.fill",
                    destination: ShoppingView()
                )

                DashboardCard(
                    title: "Tasks",
                    subtitle: "Track personal and shared tasks",
                    systemImage: "checklist",
                    destination: TasksView()
                )

                DashboardCard(
                    title: "Notes",
                    subtitle: "Capture personal and shared notes",
                    systemImage: "note.text",
                    destination: NotesView()
                )

                DashboardCard(
                    title: "Notifications",
                    subtitle: "Review reminders and updates",
                    systemImage: "bell.badge",
                    destination: NotificationsView()
                )
            }
            .padding(20)
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
        .toolbar {
            if horizontalSizeClass == .regular {
                ToolbarItem(placement: .principal) {
                    ConstrainedTitleView(title: "Dashboard")
                }
            }
        }
    }
}

private struct DashboardCard<Destination: View>: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let destination: Destination

    var body: some View {
        NavigationLink {
            destination
        } label: {
            HStack(spacing: 16) {
                ZStack {
                    Circle()
                        .fill(Color(.secondarySystemBackground))
                        .frame(width: 44, height: 44)
                    Image(systemName: systemImage)
                        .foregroundStyle(.primary)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundStyle(.tertiary)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(Color.primary.opacity(0.08), lineWidth: 1)
                    )
                    .shadow(color: Color.black.opacity(0.05), radius: 8, x: 0, y: 4)
            )
        }
        .buttonStyle(.plain)
    }
}
