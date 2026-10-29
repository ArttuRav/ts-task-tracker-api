import express from "express";
import type Database from "better-sqlite3";
import defaultDb from "./database.js";

export function createApp(database: Database.Database) {
    const app = express();
    app.use(express.json());

    const db = database;

    interface UpdateTaskInput {
        title?: string,
        completed?: boolean;
    }

    // Route for retrieving all tasks in the SQLite database
    app.get("/tasks", (req, res) => {

        // Retrieving all tasks
        const tasks = db.prepare("SELECT * FROM tasks").all() as {
            id: number;
            title: string;
            completed: number;
        }[];

        // Formatting the "completed" field to use Boolean instead of 0 and 1
        const formattedTasks = tasks.map((task) => ({
            ...task,
            completed: Boolean(task.completed)
        }));

        res.json(formattedTasks);
    });

    // Retrieving a specific task based on ID
    app.get("/tasks/:id", (req, res) => {

        // Change the type of the id retrived to a number from a string
        const id = Number(req.params.id);

        // Send an error if the id cannot be validated
        if (!Number.isInteger(id) || id < 1) {
            res.status(400).json({
                error: "Task ID must be a positive integer"
            });
            return;
        };

        // Find the task in the database based on the ID
        const task = db.prepare(
            "SELECT * FROM tasks WHERE id = ?"
        ).get(id) as {
            id: number;
            title: string;
            completed: number;
        } | undefined;

        // Check whether the task exists
        if (!task) {
            res.status(404).json({
                error: "Task not found"
            });
            return;
        }

        // Convert completed from a number to a Boolean
        res.json({
            ...task,
            completed: Boolean(task.completed)
        });
    });

    // Adding a new task
    app.post("/tasks", (req, res) => {
        // Get the title from the user input
        const title = req.body.title;

        // Validate the title
        if (typeof title !== "string" || title.trim() === "") {
            res.status(400).json({
                error: "Title is required"
            });
            return;
        };

        // Adds a new row into the database
        const result = db.prepare(
            "INSERT INTO tasks (title) VALUES (?)"
        ).run(title.trim());

        // Retrieve the newly created task from the database
        const newTask = db.prepare(
            "SELECT * FROM tasks WHERE id = ?"
        ).get(result.lastInsertRowid);

        // Send a response, converting "completed" to a Boolean
        if (!newTask) {
            res.status(500).json({ error: "Failed to create task"});
            return;
        }

        const task = newTask as {
            id: number;
            title: string;
            completed: number;
        };

        res.status(201).json({
            ...task,
            completed: Boolean(task.completed)
        });
    });

    // Updating a task
    app.patch("/tasks/:id", (req, res) => {
        // Change the type of the id retrived to a number from a string
        const id = Number(req.params.id);

        // Send an error if the id cannot be validated
        if (!Number.isInteger(id) || id < 1) {
            res.status(400).json({
                error: "Task ID must be a positive integer"
            });
            return;
        };

        // Check that a task corresponding to the id exists
        const existingTask = db.prepare(
            "SELECT id FROM tasks WHERE id = ?"
        ).get(id);

        // Send an error if the task doesn't exist
        if (!existingTask) {
            res.status(404).json({ error: "Task not found"});
            return;
        }

        // Retriving the data that is to be updated to a task
        const updates: UpdateTaskInput = req.body;

        // Validating the data

        // Making sure the request body is an object
        if (
            updates === null ||
            typeof updates !== "object" ||
            Array.isArray(updates)
        ) {
            res.status(400).json({
                error: "Request body must be an object"
            });
            return;
        };

        // Specifying which keys are allowed to be updated
        const allowedKeys = ["title", "completed"];
        const keys = Object.keys(updates);

        // Validating the keys
        if (
            // Checks that any key has been entered
            keys.length === 0 ||
            // Makes sure that only allowed keys have been entered
            keys.some((key) => !allowedKeys.includes(key))
        ) {
            res.status(400).json({
                error: "Provide title or completed, and no other fields"
            })
            return;
        };

        // Checking if the "title" field is attempted to be updated
        // Making sure the data in the "title" field is of type string and not empty
        if (
            "title" in updates &&
            (typeof updates.title !== "string" || updates.title.trim() === "")
        ) {
            res.status(400).json({
                error: "Title must be a non-empty string"
            });
            return;
        }

        // Checking if the "completed" field is attempted to be updated
        // Making sure the data in the "completed" field is of type boolean
        if (
            "completed" in updates &&
            typeof updates.completed !== "boolean"
        ) {
            res.status(400).json({
                error: "Completed must be a boolean"
            });
            return;
        };

        // Update the title if it was supplied
        if (updates.title !== undefined) {
            db.prepare(
                "UPDATE tasks SET title = ? WHERE id = ?"
            ).run(updates.title.trim(), id);
        }

        // Update the completion status if it was supplied
        if (updates.completed !== undefined) {
            db.prepare(
                "UPDATE tasks SET completed = ? WHERE id = ?"
            ).run(Number(updates.completed), id);
        }

        // Retrieve the updated task
        const updatedTask = db.prepare(
            "SELECT * FROM tasks WHERE id = ?"
        ).get(id) as {
            id: number;
            title: string;
            completed: number;
        };

        // Return completed as a Boolean
        res.json({
            ...updatedTask,
            completed: Boolean(updatedTask.completed)
        });
    });

    // Deleting a task
    app.delete("/tasks/:id", (req, res) => {
        const id = Number(req.params.id);

        // Validate the ID
        if (!Number.isInteger(id) || id < 1) {
            res.status(400).json({
                error: "Task ID must be a positive integer"
            });
            return;
        }

        // Delete the task corresponding to the ID
        const result = db.prepare(
            "DELETE FROM tasks WHERE id = ?"
        ).run(id);

        // Check if something was deleted and send an error if it was unsuccessful
        if (result.changes === 0) {
            res.status(404).json({ error: "Task not found"});
            return;
        }

        // Confirm that the task was deleted
        res.status(204).send();

    });

    return app;

}

const app = createApp(defaultDb);

export default app;