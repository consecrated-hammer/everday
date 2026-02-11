import Foundation

struct TaskList: Decodable, Identifiable {
    let Key: String
    let Name: String
    let ListId: String?
    let ListType: String
    let Count: Int?

    var id: String { Key }

    enum CodingKeys: String, CodingKey {
        case Key
        case Name
        case ListId
        case ListType = "Type"
        case Count
    }
}

struct TaskListsResponse: Decodable {
    let Lists: [TaskList]
}

struct TaskItem: Decodable, Identifiable {
    let Id: String
    let Title: String
    let Notes: String?
    let DueDate: String?
    let IsCompleted: Bool
    let ListKey: String
    let ListId: String
    let UpdatedAt: String?
    let AssignedToUserId: Int?
    let AssignedToName: String?

    var id: String { Id }
}

struct TaskListResponse: Decodable {
    let Tasks: [TaskItem]
}

struct TaskCreate: Encodable {
    let Title: String
    let Notes: String?
    let DueDate: String?
    let ListKey: String
    let AssignedToUserId: Int?
}

struct TaskUpdate: Encodable {
    let Title: String?
    let Notes: String?
    let DueDate: String?
    let IsCompleted: Bool?
    let ListKey: String
}
