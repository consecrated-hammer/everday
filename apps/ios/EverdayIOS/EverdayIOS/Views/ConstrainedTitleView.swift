import SwiftUI

struct ConstrainedTitleView: View {
    let title: String

    var body: some View {
        HStack {
            Text(title)
                .font(.headline)
            Spacer()
        }
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }
}
