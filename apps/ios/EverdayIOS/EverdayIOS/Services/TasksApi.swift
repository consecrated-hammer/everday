import Foundation

enum TasksApi {
    static func fetchLists() async throws -> TaskListsResponse {
        try await ApiClient.shared.request(
            path: "integrations/google/tasks/lists",
            requiresAuth: true
        )
    }

    static func fetchTasks(listKey: String, refresh: Bool = false) async throws -> TaskListResponse {
        let escapedKey = listKey.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? listKey
        let refreshValue = refresh ? "&refresh=1" : ""
        return try await ApiClient.shared.request(
            path: "integrations/google/tasks?list_key=\(escapedKey)\(refreshValue)",
            requiresAuth: true
        )
    }

    static func createTask(_ payload: TaskCreate) async throws -> TaskItem {
        try await ApiClient.shared.request(
            path: "integrations/google/tasks",
            method: "POST",
            body: payload,
            requiresAuth: true
        )
    }

    static func updateTask(taskId: String, payload: TaskUpdate) async throws -> TaskItem {
        try await ApiClient.shared.request(
            path: "integrations/google/tasks/\(taskId)",
            method: "PUT",
            body: payload,
            requiresAuth: true
        )
    }

    static func deleteTask(taskId: String, listKey: String) async throws {
        let escapedKey = listKey.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? listKey
        try await ApiClient.shared.requestVoid(
            path: "integrations/google/tasks/\(taskId)?list_key=\(escapedKey)",
            method: "DELETE",
            requiresAuth: true
        )
    }
}
