import SwiftUI

struct NotificationsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @EnvironmentObject var authStore: AuthStore
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
            .background(Color(.systemBackground))
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Mark all read") {
                        Task { await markAllRead() }
                    }
                    .disabled(isBusy || unreadCount == 0)
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
            statusSection
            notificationsSection
        }
        .padding(.horizontal, 20)
        .padding(.top, 20)
        .padding(.bottom, 24)
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
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
                VStack(alignment: .leading, spacing: 4) {
                    Text("No notifications")
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text("You're all caught up.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(notifications.enumerated()), id: \.element.Id) { index, notification in
                        NotificationCardView(
                            notification: notification,
                            isBusy: isBusy,
                            onOpen: { handleOpen(notification) },
                            onMarkRead: { Task { await markRead(notification) } },
                            onDismiss: { Task { await dismiss(notification) } }
                        )
                        if index < notifications.count - 1 {
                            Divider()
                                .padding(.vertical, 8)
                        }
                    }
                }
            }
        }
    }

    private var isBusy: Bool {
        status == .loading || status == .saving
    }

    private func handleOpen(_ notification: NotificationItem) {
        let rawLink = notification.LinkUrl?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if isKidUser {
            if rawLink.hasPrefix("/kids") || rawLink.isEmpty || rawLink.hasPrefix("/notifications") {
                dismiss()
            } else if let url = URL(string: rawLink), let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" {
                openURL(url)
            } else {
                pushCoordinator.queueNavigationLink(notification.LinkUrl)
            }
        } else {
            pushCoordinator.queueNavigationLink(notification.LinkUrl)
        }
        if !notification.IsRead {
            Task { await markRead(notification) }
        }
    }

    private var isKidUser: Bool {
        authStore.tokens?.role == "Kid"
    }

    private func load() async {
        status = .loading
        errorMessage = ""
        do {
            let response = try await NotificationsApi.fetchNotifications(
                includeRead: true,
                includeDismissed: false,
                limit: 200,
                offset: 0
            )
            notifications = response.Notifications
            unreadCount = response.UnreadCount
            await pushCoordinator.applyBadgeCount(response.UnreadCount)
            status = .ready
        } catch is CancellationError {
            if notifications.isEmpty {
                status = .idle
            } else {
                status = .ready
            }
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            if notifications.isEmpty {
                status = .idle
            } else {
                status = .ready
            }
            return
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
                includeDismissed: false,
                limit: 200,
                offset: 0
            )
            notifications = response.Notifications
            unreadCount = response.UnreadCount
            await pushCoordinator.applyBadgeCount(response.UnreadCount)
            status = .ready
        } catch is CancellationError {
            if notifications.isEmpty {
                status = .idle
            } else {
                status = .ready
            }
            return
        } catch let urlError as URLError where urlError.code == .cancelled {
            if notifications.isEmpty {
                status = .idle
            } else {
                status = .ready
            }
            return
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
