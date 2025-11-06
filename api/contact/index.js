import { EmailClient } from "@azure/communication-email";

const REQUIRED_FIELDS = [
	"name",
	"email",
	"specialty",
	"organization",
	"comments",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

const escapeHtml = (value = "") =>
	value
		.toString()
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

const formatCurrency = (value) => {
	const num = Number(value);
	if (!Number.isFinite(num)) {
		return currencyFormatter.format(0);
	}
	return currencyFormatter.format(Math.round(num * 100) / 100);
};

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

const normalizeNumber = (value) => {
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
};

const sanitizeContract = (rawContract) => {
	if (!rawContract) {
		return null;
	}

	let contract = rawContract;

	if (typeof rawContract === "string") {
		try {
			contract = JSON.parse(rawContract);
		} catch {
			return null;
		}
	}

	if (!contract || typeof contract !== "object") {
		return null;
	}

	const itemsSource = Array.isArray(contract.items) ? contract.items : [];
	const items = itemsSource
		.map((item) => {
			if (!item || typeof item !== "object") {
				return null;
			}

			const planName =
				typeof item.planName === "string" ? item.planName : null;
			const percentage = normalizeNumber(item.percentage);
			const fte = normalizeNumber(item.fte);
			const basePrice = normalizeNumber(item.basePrice);
			const adjustedMonthly = normalizeNumber(item.adjustedMonthly);

			if (!planName || adjustedMonthly === null) {
				return null;
			}

			return {
				planName,
				percentage,
				fte,
				basePrice,
				adjustedMonthly,
			};
		})
		.filter((item) => item !== null);

	if (items.length === 0) {
		return null;
	}

	const totalMonthly =
		normalizeNumber(contract.totalMonthly) ??
		items.reduce(
			(sum, item) => sum + (item.adjustedMonthly ?? 0),
			0,
		);

	return {
		items,
		totalMonthly,
	};
};

const buildContractPlainText = (contract) => {
	if (!contract) {
		return "";
	}

	const lines = [
		"Contract Summary:",
		...contract.items.map((item) => {
			const utilization =
				item.fte !== null && item.fte !== undefined
					? `${item.fte} FTE`
					: item.percentage !== null && item.percentage !== undefined
						? `${item.percentage}%`
						: "-";
			const priceLabel = formatCurrency(item.adjustedMonthly);
			return `- ${item.planName} (${utilization}): ${priceLabel}/month`;
		}),
		`Total: ${formatCurrency(contract.totalMonthly)}/month`,
	];

	return `\n\n${lines.join("\n")}`;
};

const buildContractHtml = (contract) => {
	if (!contract) {
		return "";
	}

	const rows = contract.items
		.map(
			(item) => `
				<tr>
					<td style="padding:4px 0;">${escapeHtml(item.planName)}</td>
					<td style="padding:4px 0;">
						${
							item.fte !== null && item.fte !== undefined
								? `${item.fte} FTE`
								: item.percentage !== null &&
										item.percentage !== undefined
									? `${item.percentage}%`
									: "-"
						}
					</td>
					<td style="padding:4px 0;">${formatCurrency(item.adjustedMonthly)}/month</td>
				</tr>
			`,
		)
		.join("");

	return `
		<h3 style="margin-top:1.5rem;">Contract Summary</h3>
		<table style="border-collapse:collapse;width:100%;margin-top:0.5rem">
			<thead>
				<tr>
					<th style="text-align:left;padding:4px 0;">Plan</th>
					<th style="text-align:left;padding:4px 0;">Utilization</th>
					<th style="text-align:left;padding:4px 0;">Monthly</th>
				</tr>
			</thead>
			<tbody>
				${rows}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="2" style="padding-top:6px;font-weight:600;">Total</td>
					<td style="padding-top:6px;font-weight:600;">${formatCurrency(contract.totalMonthly)}/month</td>
				</tr>
			</tfoot>
		</table>
	`;
};

const buildPlainText = ({
	name,
	email,
	specialty,
	organization,
	comments,
	contract,
}) =>
	`New Consultologist contact request
Name: ${name}
Email: ${email}
Specialty: ${specialty}
Clinic/Organization: ${organization}

Comments:
${comments}${buildContractPlainText(contract)}
`;

const buildHtml = ({
	name,
	email,
	specialty,
	organization,
	comments,
	contract,
}) => `
  <h2>New Consultologist contact request</h2>
  <p><strong>Name:</strong> ${escapeHtml(name)}</p>
  <p><strong>Email:</strong> ${escapeHtml(email)}</p>
  <p><strong>Specialty:</strong> ${escapeHtml(specialty)}</p>
  <p><strong>Clinic or Organization:</strong> ${escapeHtml(organization)}</p>
  <p><strong>Comments:</strong></p>
  <p>${escapeHtml(comments).replace(/\n/g, "<br />")}</p>
  ${buildContractHtml(contract)}
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

	const contractDetails = sanitizeContract(payload.contract);
	const templatePayload = {
		...cleanedPayload,
		contract: contractDetails,
	};

	try {
		const emailClient = new EmailClient(connectionString);
		const message = {
			senderAddress,
			recipients: {
				to: [{ address: recipientAddress }],
			},
			content: {
				subject: `Consultologist contact from ${cleanedPayload.name}`,
				plainText: buildPlainText(templatePayload),
				html: buildHtml(templatePayload),
			},
			replyTo: [
				{
					address: cleanedPayload.email,
				},
			],
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
