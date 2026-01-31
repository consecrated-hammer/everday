import SwiftUI
import CryptoKit

struct AvatarMenuButton: View {
    let email: String?
    let displayName: String
    let onSignOut: () -> Void

    var body: some View {
        Menu {
            Button(role: .destructive, action: onSignOut) {
                Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
            }
        } label: {
            AvatarCircleView(email: email, displayName: displayName, size: 32)
        }
        .accessibilityLabel("Account menu")
    }
}

struct AvatarCircleView: View {
    let email: String?
    let displayName: String
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(.secondarySystemBackground))
                .frame(width: size, height: size)

            if let url = gravatarUrl() {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        initialsView
                    }
                }
                .frame(width: size, height: size)
                .clipShape(Circle())
            } else {
                initialsView
            }
        }
    }

    private var initialsView: some View {
        Text(initials(from: displayName))
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
    }

    private func gravatarUrl() -> URL? {
        guard let email, !email.isEmpty else { return nil }
        let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let digest = Insecure.MD5.hash(data: Data(normalized.utf8))
        let hash = digest.map { String(format: "%02x", $0) }.joined()
        return URL(string: "https://www.gravatar.com/avatar/\(hash)?s=200&d=mp")
    }

    private func initials(from name: String) -> String {
        let parts = name.split(separator: " ")
        let first = parts.first?.first
        let last = parts.dropFirst().first?.first
        let chars = [first, last].compactMap { $0 }
        if chars.isEmpty {
            return "?"
        }
        return String(chars.prefix(2))
    }
}
