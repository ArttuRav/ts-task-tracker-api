import { afterAll, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { createDatabase } from "../src/database.js";

// Create a test database
const testDb = createDatabase(":memory:");
const app = createApp(testDb);

// Clears the database before each test
beforeEach(() => {
    testDb.exec("DELETE FROM tasks");
})

// Clear the database after all tests have been completed
afterAll(() => {
    testDb.close();
});

// GET

describe("GET /tasks", () => {
    it("should return a list of tasks", async () => {

        // Sends a GET request for all tasks
        const response = await request(app).get("/tasks");

        // Checks that the request succeeded
        expect(response.status).toBe(200);
    });

    it("should return tasks with the expected fields", async () => {

        // Sends a GET request for all tasks
        const response = await request(app).get("/tasks");

        // Checks that the request succeeded
        expect(response.status).toBe(200);

        if (response.body.length > 0) {
            const task = response.body[0];

            // Checking that the correct fields exist
            expect(task).toHaveProperty("id");
            expect(task).toHaveProperty("title");

            // Checking that the fields are of the correct type
            expect(typeof task.id).toBe("number");
            expect(typeof task.title).toBe("string");
            expect(typeof task.completed).toBe("boolean");
        }
    });

    it("should return 400 for an invalid task ID", async () => {
        const response = await request(app).get("/tasks/abc");

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: "Task ID must be a positive integer"
        });
    });

    it("should return 404 when the task does not exist", async () => {
        const response = await request(app).get("/tasks/999999");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: "Task not found"
        });
    });

    it("should return only completed tasks when completed=true", async () => {
        // Insert two tasks with different completion statuses
        testDb.prepare(
            "INSERT INTO tasks (title, completed) VALUES (?, ?)"
        ).run("Completed task", 1);

        testDb.prepare(
            "INSERT INTO tasks (title, completed) VALUES (?, ?)"
        ).run("Incomplete task", 0);

        // Request only completed tasks
        const response = await request(app)
            .get("/tasks?completed=true");

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe("Completed task");
        expect(response.body[0].completed).toBe(true);
        });

        it("should return only completed tasks when completed=false", async () => {
        // Insert two tasks with different completion statuses
        testDb.prepare(
            "INSERT INTO tasks (title, completed) VALUES (?, ?)"
        ).run("Completed task", 1);

        testDb.prepare(
            "INSERT INTO tasks (title, completed) VALUES (?, ?)"
        ).run("Incomplete task", 0);

        // Request only incomplete tasks
        const response = await request(app)
            .get("/tasks?completed=false");

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe("Incomplete task");
        expect(response.body[0].completed).toBe(false);
    });

    it("should return 400 for an invalid completed filter", async () => {
        // Send a request with an invalid query parameter
        const response = await request(app)
            .get("/tasks?completed=hello");

        // Verify the HTTP status code
        expect(response.status).toBe(400);

        // Verify the error message
        expect(response.body).toEqual({
            error: "Completed must be true or false"
        });
    });

    it("should return an empty array when no tasks match the filter", async () => {
        // Insert only an incomplete task
        testDb.prepare(
            "INSERT INTO tasks (title, completed) VALUES (?, ?)"
        ).run("Incomplete task", 0);

        // Request completed tasks
        const response = await request(app)
            .get("/tasks?completed=true");

        // Verify that no matching tasks were found
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it("should return the first page of tasks", async () => {
        // Insert six tasks into the test database
        for (let i = 1; i <= 6; i++) {
            testDb.prepare(
                "INSERT INTO tasks (title) VALUES (?)"
            ).run(`Task ${i}`);
        }

        // Request the first page with a limit of three
        const response = await request(app)
            .get("/tasks?page=1&limit=3");

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(3);

        expect(response.body.map((task: { title: string }) => task.title))
            .toEqual(["Task 1", "Task 2", "Task 3"]);
    });

    it("should return the second page of tasks", async () => {
        // Insert six tasks into the test database
        for (let i = 1; i <= 6; i++) {
            testDb.prepare(
                "INSERT INTO tasks (title) VALUES (?)"
            ).run(`Task ${i}`);
        }

        // Request the second page with a limit of three
        const response = await request(app)
            .get("/tasks?page=2&limit=3");

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(3);

        expect(response.body.map((task: { title: string }) => task.title))
            .toEqual(["Task 4", "Task 5", "Task 6"]);
    });

    it("should return an empty array when the requested page has no tasks", async () => {
        // Insert three tasks into the test database
        for (let i = 1; i <= 3; i++) {
            testDb.prepare(
                "INSERT INTO tasks (title) VALUES (?)"
            ).run(`Task ${i}`);
        }

        // Request a page beyond the available tasks
        const response = await request(app)
            .get("/tasks?page=10&limit=5");

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it("should paginate filtered completed tasks", async () => {
        // Create five tasks with alternating completion statuses
        for (let i = 1; i <= 5; i++) {
            testDb.prepare(
                "INSERT INTO tasks (title, completed) VALUES (?, ?)"
            ).run(`Task ${i}`, i % 2 === 1 ? 1 : 0);
        }

        // Request the second page of completed tasks
        const response = await request(app)
            .get("/tasks?completed=true&page=2&limit=1");

        // Verify the response
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe("Task 3");
        expect(response.body[0].completed).toBe(true);
    });

    it("should reject a page number less than 1", async () => {
        const response = await request(app)
            .get("/tasks?page=0&limit=5");

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: "Page must be a positive integer"
        });
    });

    it("should reject a limit less than 1", async () => {
        const response = await request(app)
            .get("/tasks?page=1&limit=0");

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: "Limit must be a positive integer"
        });
    });

    it("should use default pagination values", async () => {
        // Insert 12 tasks into the test database
        for (let i = 1; i <= 12; i++) {
            testDb.prepare(
                "INSERT INTO tasks (title) VALUES (?)"
            ).run(`Task ${i}`);
        }

        // Request tasks without pagination parameters
        const response = await request(app)
            .get("/tasks");

        // Verify the default limit of 10
        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(10);

        // Verify that the first page is returned
        expect(response.body[0].title).toBe("Task 1");
        expect(response.body[9].title).toBe("Task 10");
    });
});

// POST

describe("POST /tasks", () => {
    it("should create a task", async () => {
        const response = await request(app)
            .post("/tasks")
            .send({title: "Automated test task"});

        expect(response.status).toBe(201);
        expect(response.body.title).toBe("Automated test task");
        expect(response.body.completed).toBe(false);
        expect(typeof response.body.id).toBe("number");
    });

    it ("should reject an empty title", async () => {
        const response = await request(app)
            .post("/tasks")
            .send({ title: "   "});

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: "Title is required"
        });
    });

    it("should reject a non-string title", async () => {
        const response = await request(app)
            .post("/tasks")
            .send({ title: 123 });

        expect(response.status).toBe(400);
    });

    it("should reject a whitespace-only title", async () => {
        const response = await request(app)
            .post("/tasks")
            .send({ title: "   " });

        expect(response.status).toBe(400);
    });

});

// PATCH

describe("PATCH /tasks/:id", () => {
    it("should update a task's completion status", async () => {
        // Create a task for this test
        const created = await request(app)
            .post("/tasks")
            .send({ title: "Task to update "});

        const id = created.body.id;

        // Update the task
        const response = await request(app)
            .patch(`/tasks/${id}`)
            .send({ completed: true });

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(id);
        expect(response.body.completed).toBe(true);
        expect(typeof response.body.completed).toBe("boolean");
    });

    it("should update a task's title", async () => {
        const createResponse = await request(app)
            .post("/tasks")
            .send({ title: "Original title "});

        const taskId = createResponse.body.id;

        const response = await request(app)
            .patch(`/tasks/${taskId}`)
            .send({ title: "Updated title" });

        expect(response.status).toBe(200);
        expect(response.body.title).toBe("Updated title");
    });

    it("should reject an unknown field", async () => {
        const createResponse = await request(app)
            .post("/tasks")
            .send({ title: "Test task "});

        const taskId = createResponse.body.id;

        const response = await request(app)
            .patch(`/tasks/${taskId}`)
            .send({ description: "Unknown field" });

        expect(response.status).toBe(400);
    });

    it("should return 404 for a non-existent task", async () => {
        const response = await request(app)
            .patch("/tasks/999999")
            .send({ title: "Updated title" });
        
        expect(response.status).toBe(404);
    });

    it("should return 400 for an invalid task ID", async () => {
        const response = await request(app)
            .patch("/tasks/abc")
            .send({ title: "Updated title" });
        
        expect(response.status).toBe(400);
    });

    it("should reject an empty update", async () => {
        const createResponse = await request(app)
            .post("/tasks")
            .send({ title: "Test task" });
        
        const taskId = createResponse.body.id;

        const response = await request(app)
            .patch(`/tasks/${taskId}`)
            .send({});

        expect(response.status).toBe(400);
    });

    it("should reject a non-string title", async () => {
        const createResponse = await request(app)
            .post("/tasks")
            .send({ title: "Original title" });

        const taskId = createResponse.body.id;

        const response = await request(app)
            .patch(`/tasks/${taskId}`)
            .send({ title: 123 });

        expect(response.status).toBe(400);
    });

    it("should reject a non-boolean completed value", async () => {
        const createResponse = await request(app)
            .post("/tasks")
            .send({ title: "Test task" });

        const taskId = createResponse.body.id;

        const response = await request(app)
            .patch(`/tasks/${taskId}`)
            .send({ completed: "yes" });

        expect(response.status).toBe(400);
    });

});

// DELETE

describe("DELETE /tasks/:id", () => {
    it("should delete a task", async () => {
        // Create a task for this test
        const created = await request(app)
            .post("/tasks")
            .send({ title: "Task to delete" });

        const id = created.body.id;

        // Delete the task
        const response = await request(app)
            .delete(`/tasks/${id}`);

        expect(response.status).toBe(204);

        // Verify the task no longer exists
        const lookup = await request(app)
            .get(`/tasks/${id}`);

        expect(lookup.status).toBe(404);
    });

    it("should return 404 for a non-existant task", async () => {
        const response = await request(app)
            .delete("/tasks/999999");

        expect(response.status).toBe(404);
    });

});