import Foundation
import UniformTypeIdentifiers

enum LifeAdminApi {
    static func fetchCategories(includeInactive: Bool = false) async throws -> [LifeCategory] {
        let query = includeInactive ? "?include_inactive=true" : ""
        return try await ApiClient.shared.request(path: "life-admin/categories\(query)", requiresAuth: true)
    }

    static func createCategory(_ payload: LifeCategoryCreate) async throws -> LifeCategory {
        try await ApiClient.shared.request(
            path: "life-admin/categories",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateCategory(id: Int, payload: LifeCategoryUpdate) async throws -> LifeCategory {
        try await ApiClient.shared.request(
            path: "life-admin/categories/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteCategory(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/categories/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchFields(categoryId: Int) async throws -> [LifeField] {
        try await ApiClient.shared.request(
            path: "life-admin/categories/\(categoryId)/fields",
            requiresAuth: true
        )
    }

    static func createField(categoryId: Int, payload: LifeFieldCreate) async throws -> LifeField {
        try await ApiClient.shared.request(
            path: "life-admin/categories/\(categoryId)/fields",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateField(id: Int, payload: LifeFieldUpdate) async throws -> LifeField {
        try await ApiClient.shared.request(
            path: "life-admin/fields/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteField(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/fields/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchDropdowns() async throws -> [LifeDropdown] {
        try await ApiClient.shared.request(path: "life-admin/dropdowns", requiresAuth: true)
    }

    static func createDropdown(_ payload: LifeDropdownCreate) async throws -> LifeDropdown {
        try await ApiClient.shared.request(
            path: "life-admin/dropdowns",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateDropdown(id: Int, payload: LifeDropdownUpdate) async throws -> LifeDropdown {
        try await ApiClient.shared.request(
            path: "life-admin/dropdowns/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteDropdown(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/dropdowns/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchDropdownOptions(dropdownId: Int) async throws -> [LifeDropdownOption] {
        try await ApiClient.shared.request(
            path: "life-admin/dropdowns/\(dropdownId)/options",
            requiresAuth: true
        )
    }

    static func createDropdownOption(dropdownId: Int, payload: LifeDropdownOptionCreate) async throws -> LifeDropdownOption {
        try await ApiClient.shared.request(
            path: "life-admin/dropdowns/\(dropdownId)/options",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateDropdownOption(id: Int, payload: LifeDropdownOptionUpdate) async throws -> LifeDropdownOption {
        try await ApiClient.shared.request(
            path: "life-admin/dropdowns/options/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func fetchPeople() async throws -> [LifePerson] {
        try await ApiClient.shared.request(path: "life-admin/people", requiresAuth: true)
    }

    static func createPerson(_ payload: LifePersonCreate) async throws -> LifePerson {
        try await ApiClient.shared.request(
            path: "life-admin/people",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updatePerson(id: Int, payload: LifePersonUpdate) async throws -> LifePerson {
        try await ApiClient.shared.request(
            path: "life-admin/people/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func fetchRecords(categoryId: Int) async throws -> [LifeRecord] {
        try await ApiClient.shared.request(
            path: "life-admin/categories/\(categoryId)/records",
            requiresAuth: true
        )
    }

    static func createRecord(categoryId: Int, payload: LifeRecordCreate) async throws -> LifeRecord {
        try await ApiClient.shared.request(
            path: "life-admin/categories/\(categoryId)/records",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateRecord(id: Int, payload: LifeRecordUpdate) async throws -> LifeRecord {
        try await ApiClient.shared.request(
            path: "life-admin/records/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateRecordOrder(categoryId: Int, orderedIds: [Int]) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/categories/\(categoryId)/records/order",
            method: "PUT",
            body: LifeRecordOrderUpdate(OrderedIds: orderedIds),
            requiresAuth: true
        )
    }

    static func deleteRecord(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/records/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchRecordLookup(categoryId: Int) async throws -> [LifeRecordLookup] {
        try await ApiClient.shared.request(
            path: "life-admin/categories/\(categoryId)/records/lookup",
            requiresAuth: true
        )
    }

    static func fetchDocumentFolders() async throws -> [LifeDocumentFolder] {
        try await ApiClient.shared.request(path: "life-admin/document-folders", requiresAuth: true)
    }

    static func createDocumentFolder(_ payload: LifeDocumentFolderCreate) async throws -> LifeDocumentFolder {
        try await ApiClient.shared.request(
            path: "life-admin/document-folders",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateDocumentFolder(id: Int, payload: LifeDocumentFolderUpdate) async throws -> LifeDocumentFolder {
        try await ApiClient.shared.request(
            path: "life-admin/document-folders/\(id)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteDocumentFolder(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/document-folders/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func fetchDocumentTags() async throws -> [LifeDocumentTag] {
        try await ApiClient.shared.request(path: "life-admin/document-tags", requiresAuth: true)
    }

    static func uploadDocument(
        fileUrl: URL,
        title: String?,
        folderId: Int?,
        tagNames: [String]
    ) async throws -> LifeDocument {
        let needsRelease = fileUrl.startAccessingSecurityScopedResource()
        defer {
            if needsRelease {
                fileUrl.stopAccessingSecurityScopedResource()
            }
        }
        let data = try Data(contentsOf: fileUrl)
        let filename = fileUrl.lastPathComponent
        let mimeType = mimeTypeForFile(url: fileUrl)
        let boundary = "Boundary-\(UUID().uuidString)"

        var fields: [String: String] = [:]
        if let title, !title.isEmpty { fields["title"] = title }
        if let folderId { fields["folder_id"] = String(folderId) }
        if !tagNames.isEmpty { fields["tag_names"] = tagNames.joined(separator: ",") }

        let body = buildMultipartBody(
            boundary: boundary,
            fields: fields,
            fileField: "file",
            filename: filename,
            mimeType: mimeType,
            fileData: data
        )

        let url = buildAbsoluteUrl(path: "life-admin/documents")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        if let token = try await ensureAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body

        let (responseData, response) = try await URLSession.shared.data(for: request)
        return try decodeResponse(responseData, response: response)
    }

    static func fetchDocuments(
        search: String? = nil,
        folderId: Int? = nil,
        tagIds: [Int]? = nil,
        linkedOnly: Bool? = nil,
        remindersOnly: Bool? = nil,
        recordId: Int? = nil
    ) async throws -> [LifeDocument] {
        var queryItems: [String] = []
        if let search, !search.isEmpty {
            queryItems.append("search=\(escapeQuery(search))")
        }
        if let folderId {
            queryItems.append("folder_id=\(folderId)")
        }
        if let tagIds, !tagIds.isEmpty {
            let joined = tagIds.map(String.init).joined(separator: ",")
            queryItems.append("tag_ids=\(joined)")
        }
        if linkedOnly == true {
            queryItems.append("linked_only=true")
        }
        if remindersOnly == true {
            queryItems.append("reminders_only=true")
        }
        if let recordId {
            queryItems.append("record_id=\(recordId)")
        }
        let query = queryItems.isEmpty ? "" : "?\(queryItems.joined(separator: "&"))"
        return try await ApiClient.shared.request(
            path: "life-admin/documents\(query)",
            requiresAuth: true
        )
    }

    static func fetchDocumentDetail(id: Int) async throws -> LifeDocumentDetail {
        try await ApiClient.shared.request(path: "life-admin/documents/\(id)", requiresAuth: true)
    }

    static func updateDocument(id: Int, payload: LifeDocumentUpdate) async throws -> LifeDocument {
        try await ApiClient.shared.request(
            path: "life-admin/documents/\(id)",
            method: "PATCH",
            body: payload,
            requiresAuth: true
        )
    }

    static func addDocumentTags(id: Int, tagNames: [String]) async throws -> [LifeDocumentTag] {
        try await ApiClient.shared.request(
            path: "life-admin/documents/\(id)/tags",
            method: "POST",
            body: LifeDocumentTagUpdate(TagNames: tagNames),
            requiresAuth: true
        )
    }

    static func removeDocumentTag(documentId: Int, tagId: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/documents/\(documentId)/tags/\(tagId)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func createDocumentLink(documentId: Int, payload: LifeDocumentLinkCreate) async throws -> LifeDocumentLink {
        try await ApiClient.shared.request(
            path: "life-admin/documents/\(documentId)/links",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteDocumentLink(documentId: Int, linkId: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/documents/\(documentId)/links/\(linkId)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func createReminder(_ payload: LifeReminderCreate) async throws -> LifeReminder {
        try await ApiClient.shared.request(
            path: "life-admin/reminders",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func fetchReminders(sourceType: String? = nil, sourceId: Int? = nil) async throws -> [LifeReminder] {
        var queryItems: [String] = []
        if let sourceType, !sourceType.isEmpty {
            queryItems.append("source_type=\(escapeQuery(sourceType))")
        }
        if let sourceId {
            queryItems.append("source_id=\(sourceId)")
        }
        let query = queryItems.isEmpty ? "" : "?\(queryItems.joined(separator: "&"))"
        return try await ApiClient.shared.request(
            path: "life-admin/reminders\(query)",
            requiresAuth: true
        )
    }

    static func updateReminder(id: Int, payload: LifeReminderUpdate) async throws -> LifeReminder {
        try await ApiClient.shared.request(
            path: "life-admin/reminders/\(id)",
            method: "PATCH",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteReminder(id: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "life-admin/reminders/\(id)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func applyAiSuggestion(documentId: Int) async throws -> LifeDocument {
        try await ApiClient.shared.request(
            path: "life-admin/documents/\(documentId)/ai/apply",
            method: "POST",
            requiresAuth: true
        )
    }

    private static func buildAbsoluteUrl(path: String) -> URL {
        let env = EnvironmentStore.resolvedEnvironment()
        let raw = env.baseUrl
        let withScheme = raw.hasPrefix("http") ? raw : "https://\(raw)"
        let normalized = withScheme.hasSuffix("/api") ? withScheme : "\(withScheme)/api"
        let baseUrl = URL(string: normalized) ?? URL(string: "https://everday-dev.batserver.au/api")!
        let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return baseUrl.appendingPathComponent(trimmed)
    }

    private static func ensureAccessToken() async throws -> String? {
        guard let tokens = ApiClient.shared.tokensProvider?() else { return nil }
        if JwtHelper.isTokenExpired(tokens.accessToken) {
            struct RefreshRequest: Encodable { let RefreshToken: String }
            let refreshed: AuthTokens = try await ApiClient.shared.request(
                path: "auth/refresh",
                method: "POST",
                body: RefreshRequest(RefreshToken: tokens.refreshToken),
                requiresAuth: false
            )
            ApiClient.shared.tokensHandler?(refreshed)
            return refreshed.accessToken
        }
        return tokens.accessToken
    }

    private static func decodeResponse<T: Decodable>(_ data: Data, response: URLResponse) throws -> T {
        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            if let message = errorMessage(from: data) {
                throw ApiError(message: message)
            }
            throw ApiError(message: "Request failed")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    private static func errorMessage(from data: Data) -> String? {
        if let text = String(data: data, encoding: .utf8), !text.isEmpty {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let detail = json["detail"] as? String, !detail.isEmpty {
                return detail
            }
            return text
        }
        return nil
    }

    private static func buildMultipartBody(
        boundary: String,
        fields: [String: String],
        fileField: String,
        filename: String,
        mimeType: String,
        fileData: Data
    ) -> Data {
        var body = Data()
        let boundaryPrefix = "--\(boundary)\r\n"

        for (key, value) in fields {
            body.append(boundaryPrefix.data(using: .utf8) ?? Data())
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8) ?? Data())
            body.append("\(value)\r\n".data(using: .utf8) ?? Data())
        }

        body.append(boundaryPrefix.data(using: .utf8) ?? Data())
        body.append("Content-Disposition: form-data; name=\"\(fileField)\"; filename=\"\(filename)\"\r\n".data(using: .utf8) ?? Data())
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8) ?? Data())
        body.append(fileData)
        body.append("\r\n".data(using: .utf8) ?? Data())
        body.append("--\(boundary)--\r\n".data(using: .utf8) ?? Data())
        return body
    }

    private static func mimeTypeForFile(url: URL) -> String {
        if let type = UTType(filenameExtension: url.pathExtension),
           let mime = type.preferredMIMEType {
            return mime
        }
        return "application/octet-stream"
    }

    private static func escapeQuery(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }
}
