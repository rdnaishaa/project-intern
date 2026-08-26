# Approval Transmittal HRBP

> Web-based document approval and verification system for the HRBP document transmittal process.

## Overview

**Approval Transmittal HRBP** is a web application designed to digitalize the document submission, sequential review, approval, and verification process.

The system enables documents to be reviewed and approved in a predefined sequence, with digital signature evidence and real-time approval tracking through a public verification page and QR Code.

---

## Key Features

- 📄 **Document Submission**  
  Submit documents with applicant, department, date, document link/file, and approval flow.

- 🔄 **Sequential Approval**  
  Reviewers and Approvers must complete their tasks according to the predefined order.

- ✍️ **Digital Signature**  
  Sign documents directly through the system using a signature pad.

- 🚫 **Reject & Revision**  
  Rejected documents are returned to the applicant for revision before resubmission.

- 📱 **QR Verification**  
  QR Code provides access to a public verification page showing the latest approval progress.

- 📊 **Approval Tracking**  
  Track which Reviewers and Approvers have completed their steps and who is currently pending.

- 🔐 **Microsoft Authentication**  
  Authentication is required only when performing approval or rejection actions.

- 💬 **WhatsApp Notification**  
  Approval links can be delivered to the next Reviewer or Approver through WhatsApp.

---

## Approval Flow

```text
Applicant / HRBP
       │
       ▼
Document Submission
       │
       ▼
Approval Chain
       │
       ├── Reviewer 1
       ├── Reviewer 2
       ├── Reviewer 3
       │
       ├── Approver 1
       ├── Approver 2
       └── Approver 3
              │
              ▼
        Final Approval
````

Each approval step must be completed sequentially.

A user cannot approve or sign before their assigned step becomes active.

---

## Public Verification

The document can be accessed through a public link or QR Code without logging in.

The verification page displays:

* Document name
* Applicant
* Department
* Submission date
* Document link
* Reviewer progress
* Approver progress
* Approval status
* Approval date and time

### Example

```text
DOCUMENT VERIFIED

Document
Surat Permohonan ABC

Applicant
John Doe

Department
HRBP

Approval Progress
━━━━━━━━━━━━━━━━━━

✓ Reviewer 1
  Approved · 09:15 WIB

✓ Reviewer 2
  Approved · 10:20 WIB

● Reviewer 3
  Waiting

○ Approver 1
  Waiting

Progress: 2 / 4
Status: IN APPROVAL
```

The QR Code remains the same throughout the approval process and displays the latest approval status.

---

## Approval Authentication

Viewing a document does not require authentication.

Authentication is required when performing an approval action.

```text
Public Document Page
        │
        ▼
   Approve Now
        │
        ▼
 Microsoft Login
        │
        ▼
Identity Validation
        │
        ▼
Sequence Validation
        │
        ▼
Digital Signature
        │
        ▼
Approve / Reject
```

Only the Reviewer or Approver assigned to the current approval step can perform the action.

---

## Document & Signature

The original uploaded document is preserved.

After all approval steps are completed, the final document contains the approval evidence at the bottom of the document/final page.

Each signature records:

* Name
* Role
* Position
* Area
* Date
* Time

The signature can be cleared and redrawn directly in the system.

---

## Technology Stack

| Layer          | Technology               |
| -------------- | ------------------------ |
| Frontend       | React, Vite              |
| Styling        | Tailwind CSS             |
| Backend        | Node.js, Express.js      |
| Authentication | Microsoft Authentication |
| Verification   | QR Code                  |
| Notification   | WhatsApp Integration     |
| Document       | PDF / DOC / DOCX         |

---

## Project Structure

```text
approval-transmittal-hrbp/
├── approval-transmittal-frontend/
├── public/
├── uploads/
├── data/
├── server.js
├── package.json
└── README.md
```

---

## Getting Started

### 1. Clone Repository

```bash
git clone https://github.com/rdnaishaa/project-intern.git
cd project-intern
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Backend

```bash
npm start
```

### 4. Run Frontend

```bash
cd approval-transmittal-frontend
npm install
npm run dev
```

Open the local URL shown in the terminal.

---

## Project Status

🚧 **Currently under development**

### Current Focus

* Document submission
* Sequential Reviewer & Approver flow
* Digital signature
* Approval tracking
* Public QR verification
* Access control
* Microsoft authentication
* WhatsApp notification integration
* Final document generation

---

## Author

**R. Aisha Syauqi Ramadhani**

GitHub: [@rdnaishaa](https://github.com/rdnaishaa)
