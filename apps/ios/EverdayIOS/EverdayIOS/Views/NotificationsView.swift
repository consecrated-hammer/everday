import SwiftUI

struct NotificationsView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @EnvironmentObject var pushCoordinator: PushNotificationCoordinator

    @State private var notifications: [NotificationItem] = []
    @State private var unreadCount = 0
    @State private var status: LoadState = .idle
    @State private var errorMessage = ""

    var body: some View {
        let scroll = ScrollView {
            contentView
        }
        .refreshable {
            await load()
        }

        let base = scroll
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(horizontalSizeClass == .regular ? .inline : .large)
            .toolbar {
                if horizontalSizeClass == .regular {
                    ToolbarItem(placement: .principal) {
                        ConstrainedTitleView(title: "Notifications")
                    }
                }
            }

        let tasks = base
            .task {
                if status == .idle {
                    await load()
                }
            }

        return AnyView(tasks)
    }

    private var contentView: AnyView {
        AnyView(contentBody)
    }

    @ViewBuilder
    private var contentBody: some View {
        VStack(alignment: .leading, spacing: 16) {
            headerSection
            actionSection
            statusSection
            notificationsSection
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 24)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Notifications")
                .font(.title2.bold())
            Text("Review all notifications, including dismissed items.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if unreadCount > 0 {
                Text("\(unreadCount) unread")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var actionSection: some View {
        ViewThatFits {
            HStack(spacing: 12) {
                refreshButton
                markAllReadButton
            }

            VStack(alignment: .leading, spacing: 8) {
                refreshButton
                markAllReadButton
            }
        }
    }

    @ViewBuilder
    private var statusSection: some View {
        if status == .loading {
            ProgressView("Loading notifications...")
                .frame(maxWidth: .infinity, alignment: .center)
        }

        if !errorMessage.isEmpty {
            Text(errorMessage)
                .font(.footnote)
                .foregroundStyle(.red)
        }
    }

    @ViewBuilder
    private var notificationsSection: some View {
        if status != .loading {
            if notifications.isEmpty {
                Text("No notifications yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                VStack(spacing: 12) {
                    ForEach(notifications) { notification in
                        NotificationCardView(
                            notification: notification,
                            isBusy: isBusy,
                            onOpen: { handleOpen(notification) },
                            onMarkRead: { Task { await markRead(notification) } },
                            onDismiss: { Task { await dismiss(notification) } }
                        )
                    }
                }
            }
        }
    }

    private var refreshButton: some View {
        Button(status == .loading ? "Refreshing..." : "Refresh") {
            Task { await load() }
        }
        .buttonStyle(.borderedProminent)
        .disabled(isBusy)
    }

    private var markAllReadButton: some View {
        Button("Mark all read") {
            Task { await markAllRead() }
        }
        .buttonStyle(.bordered)
        .disabled(isBusy || unreadCount == 0)
    }

    private var isBusy: Bool {
        status == .loading || status == .saving
    }

    private func handleOpen(_ notification: NotificationItem) {
        pushCoordinator.queueNavigationLink(notification.LinkUrl)
        if !notification.IsRead {
            Task { await markRead(notification) }
        }
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            let response = try await NotificationsApi.fetchNotifications(
                includeRead: true,
                includeDismissed: true,
                limit: 200,
                offset: 0
            )
            notifications = response.Notifications
            unreadCount = response.UnreadCount
            await pushCoordinator.applyBadgeCount(response.UnreadCount)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to load notifications."
        }
    }

    private func markRead(_ notification: NotificationItem) async {
        guard !notification.IsRead else { return }
        status = .saving
        errorMessage = ""
        do {
            _ = try await NotificationsApi.markRead(notificationId: notification.Id)
            await refreshAfterAction()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to mark as read."
        }
    }

    private func dismiss(_ notification: NotificationItem) async {
        guard !notification.IsDismissed else { return }
        status = .saving
        errorMessage = ""
        do {
            _ = try await NotificationsApi.dismiss(notificationId: notification.Id)
            await refreshAfterAction()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to dismiss notification."
        }
    }

    private func markAllRead() async {
        guard unreadCount > 0 else { return }
        status = .saving
        errorMessage = ""
        do {
            _ = try await NotificationsApi.markAllRead()
            await refreshAfterAction()
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to mark all read."
        }
    }

    private func refreshAfterAction() async {
        do {
            let response = try await NotificationsApi.fetchNotifications(
                includeRead: true,
                includeDismissed: true,
                limit: 200,
                offset: 0
            )
            notifications = response.Notifications
            unreadCount = response.UnreadCount
            await pushCoordinator.applyBadgeCount(response.UnreadCount)
            status = .ready
        } catch {
            status = .error
            errorMessage = (error as? ApiError)?.message ?? "Failed to refresh notifications."
        }
    }
}

private struct NotificationCardView: View {
    let notification: NotificationItem
    let isBusy: Bool
    let onOpen: () -> Void
    let onMarkRead: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .top, spacing: 12) {
                Text(notification.Title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Spacer(minLength: 12)
                StatusBadge(label: statusLabel)
            }

            if let body = notification.Body, !body.isEmpty {
                Text(body)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if !metaLabel.isEmpty {
                Text(metaLabel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            actionSection
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private var actionSection: some View {
        ViewThatFits {
            HStack(spacing: 8) {
                actionButtons
            }

            VStack(alignment: .leading, spacing: 8) {
                actionButtons
            }
        }
    }

    @ViewBuilder
    private var actionButtons: some View {
        if hasAction {
            Button(actionLabel) { onOpen() }
                .buttonStyle(.borderedProminent)
                .disabled(isBusy)
        }

        if !notification.IsRead {
            Button("Mark read") { onMarkRead() }
                .buttonStyle(.bordered)
                .disabled(isBusy)
        }

        if !notification.IsDismissed {
            Button("Dismiss") { onDismiss() }
                .buttonStyle(.bordered)
                .disabled(isBusy)
        }
    }

    private var metaLabel: String {
        NotificationsFormatters.metaLabel(createdAt: notification.CreatedAt, createdByName: notification.CreatedByName)
    }

    private var statusLabel: String {
        NotificationsFormatters.statusLabel(isRead: notification.IsRead, isDismissed: notification.IsDismissed)
    }

    private var actionLabel: String {
        let label = notification.ActionLabel?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return label.isEmpty ? "Open" : label
    }

    private var hasAction: Bool {
        guard let link = notification.LinkUrl?.trimmingCharacters(in: .whitespacesAndNewlines) else { return false }
        return !link.isEmpty
    }
}

private struct StatusBadge: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                Capsule(style: .continuous)
                    .fill(Color(.tertiarySystemFill))
            )
    }
}

private enum LoadState {
    case idle
    case loading
    case saving
    case ready
    case error
}
