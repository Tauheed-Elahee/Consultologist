import { EmailClient } from "@azure/communication-email";

const REQUIRED_FIELDS = ["name", "specialty", "organization", "comments"];

const escapeHtml = (value = "") =>
	value
		.toString()
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const parseRequestBody = (body) => {
	if (!body) return {};
	if (typeof body === "string") {
		try {
			return JSON.parse(body);
		} catch {
			return {};
		}
	}
	return body;
};

const buildPlainText = ({ name, specialty, organization, comments }) =>
	`New Consultologist contact request
Name: ${name}
Specialty: ${specialty}
Clinic/Organization: ${organization}

Comments:
${comments}
`;

const buildHtml = ({ name, specialty, organization, comments }) => `
  <h2>New Consultologist contact request</h2>
  <p><strong>Name:</strong> ${escapeHtml(name)}</p>
  <p><strong>Specialty:</strong> ${escapeHtml(specialty)}</p>
  <p><strong>Clinic or organization:</strong> ${escapeHtml(organization)}</p>
  <p><strong>Comments:</strong></p>
  <p>${escapeHtml(comments).replace(/\n/g, "<br />")}</p>
`;

export default async function (context, req) {
	context.log("Contact function invoked");

	const connectionString = process.env.ACS_CONNECTION_STRING;
	const senderAddress = process.env.ACS_SENDER_ADDRESS;
	const recipientAddress = process.env.ACS_CONTACT_RECIPIENT || senderAddress;

	if (!connectionString || !senderAddress || !recipientAddress) {
		context.log.error(
			"ACS configuration missing. Ensure ACS_CONNECTION_STRING, ACS_SENDER_ADDRESS, and ACS_CONTACT_RECIPIENT are set.",
		);
		context.res = {
			status: 500,
			headers: { "Content-Type": "application/json" },
			body: {
				error:
					"Azure Communication Services is not configured. Please verify your connection string and sender settings.",
			},
		};
		return;
	}

	const payload = parseRequestBody(req.body);
	const missingFields = REQUIRED_FIELDS.filter((field) => {
		const value = payload[field];
		return !value || !value.toString().trim();
	});

	if (missingFields.length > 0) {
		context.res = {
			status: 400,
			headers: { "Content-Type": "application/json" },
			body: {
				error: `Missing fields: ${missingFields.join(", ")}`,
			},
		};
		return;
	}

	const cleanedPayload = REQUIRED_FIELDS.reduce((acc, field) => {
		acc[field] = payload[field].toString().trim();
		return acc;
	}, {});

	try {
		const emailClient = new EmailClient(connectionString);
		const message = {
			senderAddress,
			recipients: {
				to: [{ address: recipientAddress }],
			},
			content: {
				subject: `Consultologist contact from ${cleanedPayload.name}`,
				plainText: buildPlainText(cleanedPayload),
				html: buildHtml(cleanedPayload),
			},
		};

		const poller = await emailClient.beginSend(message);
		const result = await poller.pollUntilDone();

		if (!result?.id) {
			throw new Error(
				"Azure Communication Services did not return an operation ID.",
			);
		}

		context.res = {
			status: 200,
			headers: { "Content-Type": "application/json" },
			body: {
				message: "Request sent successfully. Our team will reach out shortly.",
				operationId: result.id,
			},
		};
	} catch (error) {
		context.log.error("Failed to send ACS email:", {
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
		});

		context.res = {
			status: 500,
			headers: { "Content-Type": "application/json" },
			body: {
				error:
					"We were unable to relay your request. Please verify your ACS credentials and try again.",
			},
		};
	}
}
