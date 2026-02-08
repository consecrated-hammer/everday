import SwiftUI

struct HealthSectionCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(.systemBackground))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
    }
}

struct HealthSectionHeader: View {
    let title: String
    let subtitle: String?
    var trailing: AnyView? = nil

    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                if let subtitle, !subtitle.isEmpty {
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if let trailing {
                trailing
            }
        }
    }
}

struct HealthEmptyState: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(.secondary)
    }
}

struct HealthErrorBanner: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.footnote)
            .foregroundStyle(.red)
    }
}

struct HealthMetricTile: View {
    let title: String
    let value: String
    let detail: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
            if let detail, !detail.isEmpty {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct HealthProgressRow: View {
    let title: String
    let value: Double
    let target: Double
    let unit: String

    private var clampedValue: Double {
        guard target > 0 else { return 0 }
        return min(value, target)
    }

    private var overAmount: Double {
        guard target > 0 else { return 0 }
        return max(value - target, 0)
    }

    var body: some View {
        let decimals = (unit == "kcal" || unit == "steps") ? 0 : 1
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(HealthFormatters.formatNumber(value, decimals: decimals)) / \(HealthFormatters.formatNumber(target, decimals: decimals)) \(unit)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            ProgressView(value: clampedValue, total: max(target, 1))
            if overAmount > 0 {
                Text("Over by \(HealthFormatters.formatNumber(overAmount, decimals: decimals)) \(unit)")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }
}

struct HealthChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .padding(.vertical, 6)
                .padding(.horizontal, 12)
                .background(isSelected ? Color.accentColor.opacity(0.15) : Color(.secondarySystemBackground))
                .foregroundStyle(isSelected ? Color.accentColor : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}
