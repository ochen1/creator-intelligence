### **Detailed Implementation Plan: Agentic Creator Intelligence Platform**

This plan provides a granular, task-oriented breakdown for building the Creator Intelligence Platform. Each task is designed to be a self-contained unit of work that directly corresponds to the requirements outlined in the SRD and the high-level implementation plan.

---

### **Phase 0: Project Setup & Foundation (Est. 2 Hours)**

This phase establishes the technical foundation of the project.

**Task 0.1: Initialize Next.js Project**
*   **Details:** Create a new Next.js project using the App Router, TypeScript, and Tailwind CSS.
*   **Acceptance Criteria:**
    *   Run `pnpm create next-app@latest`.
    *   Project is created and runs successfully with `pnpm run dev`.
    *   ESLint and basic configuration files are present.

**Task 0.2: Install Dependencies**
*   **Details:** Install all necessary libraries for the database, UI, and state management.
*   **Acceptance Criteria:**
    *   Run `pnpm install prisma @prisma/client @tanstack/react-query lucide-react sonner class-variance-authority clsx tailwind-merge`.
    *   Run `pnpm install -D typescript @types/node`.
    *   Initialize `shadcn/ui` with `pnpm dlx shadcn-ui@latest init`.
    *   Add required `shadcn/ui` components (e.g., button, card, input, table, sheet, etc.).

**Task 0.3: Setup Prisma and Database**
*   **Details:** Configure Prisma, define the database schema, and run the initial migration to create the SQLite database file.
*   **Acceptance Criteria:**
    *   Run `pnpm prisma init`.
    *   Create a `.env` file with the content `DATABASE_URL="file:./dev.db"`.
    *   Copy the complete schema from the Implementation Plan into `prisma/schema.prisma`.
    *   Run `pnpm prisma migrate dev --name init`.
    *   A `dev.db` file is created in the `prisma/` directory.
    *   A `prisma/client` is generated successfully.

**Task 0.4: Configure Core Providers**
*   **Details:** Create the root providers for TanStack Query and Sonner notifications.
*   **Acceptance Criteria:**
    *   Create `src/components/Providers.tsx`.
    *   The component must include `<QueryClientProvider>` and `<Toaster />`.
    *   The root `src/app/layout.tsx` must wrap its children with the `<Providers>` component.

---

### **Phase 1: Backend API Development (Est. 8-10 Hours)**

This phase focuses on building all the necessary server-side logic and API endpoints.

**Task 1.1: Campaigns API (`/api/campaigns`)**
*   **Details:** Implement full CRUD functionality for campaigns.
*   **Acceptance Criteria:**
    *   **`GET /api/campaigns`:** Returns a JSON array of all campaigns, ordered by `campaign_date` descending.
    *   **`POST /api/campaigns`:** Creates a new campaign. Must validate that `campaign_name` is a non-empty string, `campaign_date` is a valid date, and `campaign_type` is one of the enum values. Returns `201 Created` on success.
    *   **`PATCH /api/campaigns/[id]`:** Updates an existing campaign.
    *   **`DELETE /api/campaigns/[id]`:** Deletes a campaign. **Crucially, it must first check if any `Attribution` records reference this campaign. If so, return a `409 Conflict` error with a descriptive message.**

**Task 1.2: Profiles API (`/api/profiles`)**
*   **Details:** Implement endpoints for fetching lists of profiles and individual profile details.
*   **Acceptance Criteria:**
    *   **`GET /api/profiles`:**
        *   Accepts `search`, `status`, `page`, and `pageSize` query parameters.
        *   The `status` filter correctly maps to the boolean flags on the `Profile` model (e.g., `status=follower` maps to `where: { is_active_follower: true, is_currently_following: false }`).
        *   The `search` filter queries against both `current_username` and `username_history`.
        *   Pagination is correctly implemented using `skip` and `take`.
        *   The response includes `data`, `total`, and `totalPages`.
    *   **`GET /api/profiles/[username]`:** Returns a single profile object, including its `interaction_events` (ordered descending by `event_ts`), `tags`, and `username_history`.
    *   **`PATCH /api/profiles/[username]`:** Updates only the `notes` field of the specified profile.

**Task 1.3: Attribution API (`/api/events` & `/api/attributions`)**
*   **Details:** Implement endpoints for managing event attributions, both individually and in bulk.
*   **Acceptance Criteria:**
    *   **`POST /api/events/[eventId]/attribution`:** Implements an "upsert" logic. Creates an `Attribution` if one doesn't exist for the `eventId`, or updates the existing one. Validates that `campaign_id` is provided if `reason` is `OP_CAMPAIGN`.
    *   **`DELETE /api/events/[eventId]/attribution`:** Removes the `Attribution` record for the given `eventId`.
    *   **`POST /api/attributions/bulk`:**
        *   Accepts an array of `profile_pks`, a `reason`, an optional `campaign_id`, and a `target` (`FOLLOWED` or `UNFOLLOWED`).
        *   For each `profile_pk`, it finds the latest `InteractionEvent` matching the `target` type.
        *   It only creates new `Attribution` records for events that do not already have one.
        *   Returns a summary of actions taken (e.g., `{ created: 5, skipped: 2 }`).

**Task 1.4: Ingestion API (`/api/ingest`)**
*   **Details:** Build the core data ingestion engine. This is the most complex endpoint and must be implemented within a single database transaction.
*   **Acceptance Criteria:**
    1.  **Receive Data:** Endpoint accepts a POST request with the required JSON strings and filename.
    2.  **Snapshot Check:** Parses the `YYYY-MM-DD` date from the filename and checks the `Snapshot` table. Returns `409 Conflict` if the date already exists.
    3.  **Transaction Logic:** The entire process from step 4-9 is wrapped in `prisma.$transaction`.
    4.  **Parse & Reconcile Profiles:** All unique usernames are identified. `prisma.profile.upsert` is used to ensure all profiles exist before proceeding.
    5.  **Fetch Current State:** A single query fetches all profiles from the current snapshot lists *plus* any profile in the DB with an active state flag (`is_active_follower: true`, etc.).
    6.  **State Diffing:** The logic from SRD FR-1.3 is implemented precisely. For each detected change:
        *   An `InteractionEvent` is added to an in-memory array.
        *   A `Profile` update is added to an in-memory array.
    7.  **Persist Changes:** `prisma.interactionEvent.createMany` and a loop of `prisma.profile.update` are called within the transaction.
    8.  **Record Snapshot:** A new record is created in the `Snapshot` table.
    9.  **Commit & Respond:** The transaction is committed. The API returns a `200 OK` with a summary of the ingestion results (e.g., number of new followers, unfollows, events created).

---

### **Phase 2: Frontend UI Development (Est. 6-8 Hours)**

This phase focuses on building the user interface components that interact with the backend APIs.

**Task 2.1: Campaign Manager Component (`CampaignManager.tsx`)**
*   **Details:** Build the UI for creating, viewing, and deleting campaigns.
*   **Acceptance Criteria:**
    *   Uses `useQuery(['campaigns'])` to fetch and display all campaigns in a table.
    *   A form allows users to create new campaigns. The form submission uses `useMutation` which, on success, invalidates the `['campaigns']` query to refresh the list.
    *   Delete buttons on each row trigger a `useMutation` to delete the campaign, again invalidating the query on success.
    *   Loading and error states are handled gracefully.

**Task 2.2: Profile List Component (`ProfileList.tsx`)**
*   **Details:** Build the main audience table with filtering, pagination, and selection.
*   **Acceptance Criteria:**
    *   `useState` hooks manage all filter states (`searchQuery`, `statusFilter`, `page`).
    *   `useQuery(['profiles', { filters... }])` fetches data. The query key includes all filter states to enable automatic refetching.
    *   A `TanStack Table` is used to render the data.
    *   Row selection is implemented with checkboxes. The list of selected `profile_pk`s is managed in state and passed up to the parent `page.tsx`.
    *   Clicking a table row (outside the checkbox) triggers the `onSelectProfile` callback.

**Task 2.3: Profile Sheet Component (`ProfileSheet.tsx`)**
*   **Details:** Build the detailed side-panel view for a single profile.
*   **Acceptance Criteria:**
    *   The component is controlled by `open` and `username` props.
    *   It uses `useQuery(['profile', username])` to fetch detailed data for the specific user.
    *   The event timeline is rendered, with each event showing its type and timestamp.
    *   Each event has an attribution control component that allows setting/clearing the attribution via `useMutation`.
    *   The notes section supports inline editing, with a `useMutation` to save changes to the backend.

**Task 2.4: Bulk Attribution Sheet Component (`BulkProfilesAttributionSheet.tsx`)**
*   **Details:** Build the UI for applying attributions to multiple selected profiles.
*   **Acceptance Criteria:**
    *   The sheet is displayed when one or more profiles are selected.
    *   It contains a form to select `reason`, `campaign`, and `target`.
    *   The "Apply" button triggers a `useMutation` that calls the `POST /api/attributions/bulk` endpoint with the selected `profile_pks` and form data.
    *   On success, it closes the sheet and clears the profile selection.

---

### **Phase 3: Agentic Features**

*   **Status:** Deferred. As per the implementation plan, this phase will not be implemented during the initial build.

---

### **Phase 4: Final Polish & Demo Preparation (Est. 2-3 Hours)**

This phase focuses on improving the user experience and preparing a compelling demo.

**Task 4.1: Create a Demo Seed Script (`scripts/seed.ts`)**
*   **Details:** Write a script that can be run to populate the database with realistic-looking data.
*   **Acceptance Criteria:**
    *   The script creates 2-3 campaigns.
    *   It creates 50-100 profiles.
    *   It generates a plausible history of `InteractionEvent`s for these profiles (e.g., a wave of follows after a campaign date).
    *   The script is idempotent and can be run safely multiple times.

**Task 4.2: UI/UX Polish**
*   **Details:** Refine the user interface and add user feedback mechanisms.
*   **Acceptance Criteria:**
    *   All data-fetching components display a loading spinner while `isLoading`.
    *   All data-fetching components display a clear error message if `isError`.
    *   All mutations (create, update, delete) display a `sonner` toast notification on success or failure.
    *   The layout is responsive and usable on smaller screen sizes.
    *   Tooltips are added to icons and complex UI elements to improve clarity.
