import Foundation

enum NotesApi {
    static func fetchNotes(scope: NotesScope, archived: Bool) async throws -> [NoteResponse] {
        let archivedValue = archived ? "true" : "false"
        return try await ApiClient.shared.request(
            path: "notes?scope=\(scope.rawValue)&archived=\(archivedValue)",
            requiresAuth: true
        )
    }

    static func fetchShareUsers() async throws -> [NoteShareUser] {
        try await ApiClient.shared.request(path: "notes/share-users", requiresAuth: true)
    }

    static func createNote(_ payload: NoteCreate) async throws -> NoteResponse {
        try await ApiClient.shared.request(
            path: "notes",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateNote(noteId: Int, payload: NoteUpdate) async throws -> NoteResponse {
        try await ApiClient.shared.request(
            path: "notes/\(noteId)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteNote(noteId: Int) async throws {
        try await ApiClient.shared.requestVoid(
            path: "notes/\(noteId)",
            method: "DELETE",
            requiresAuth: true
        )
    }

    static func archive(noteId: Int) async throws -> NoteResponse {
        try await ApiClient.shared.request(
            path: "notes/\(noteId)/archive",
            method: "POST",
            requiresAuth: true
        )
    }

    static func unarchive(noteId: Int) async throws -> NoteResponse {
        try await ApiClient.shared.request(
            path: "notes/\(noteId)/unarchive",
            method: "POST",
            requiresAuth: true
        )
    }

    static func togglePin(noteId: Int) async throws -> NoteResponse {
        try await ApiClient.shared.request(
            path: "notes/\(noteId)/toggle-pin",
            method: "POST",
            requiresAuth: true
        )
    }
}
