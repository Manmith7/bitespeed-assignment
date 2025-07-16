import db from "../config/db.js";

export const IdentityController = async (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
        return res.status(400).json({ message: "Email or phoneNumber is required" });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailPattern.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
    }

    // const phonePattern = /^\d{10}$/;
    // if (phoneNumber && !phonePattern.test(phoneNumber)) {
    //     return res.status(400).json({ message: "Phone number is incorrect" });
    // }

    try {
        const [contacts] = await db.execute(
            `SELECT * FROM contacts WHERE (email = ? AND ? IS NOT NULL) OR (phoneNumber = ? AND ? IS NOT NULL)`,
            [email, email, phoneNumber, phoneNumber]
        );

        if (contacts.length === 0) {
            const [result] = await db.execute(
                `INSERT INTO contacts (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt) 
                 VALUES (?, ?, NULL, 'primary', NOW(), NOW(), NULL)`,
                [phoneNumber, email]
            );

            return res.status(201).json({
                contact: {
                    primaryContactId: result.insertId,
                    emails: email ? [email] : [],
                    phoneNumbers: phoneNumber ? [phoneNumber] : [],
                    secondaryContactIds: []
                }
            });
        }

        const contactIds = contacts.map(c => c.id);
        const linkedIds = contacts.map(c => c.linkedId).filter(id => id !== null);
        const uniqueIds = [...new Set([...contactIds, ...linkedIds])];

        let allContacts = [];

        if (uniqueIds.length > 0) {
            const [contactsResult] = await db.execute(
                `SELECT * FROM contacts WHERE id IN (${uniqueIds.join(",")}) OR linkedId IN (${uniqueIds.join(",")})`
            );
            allContacts = contactsResult;
        } else {
            allContacts = contacts;
        }

        let primaryContact = allContacts
            .filter(c => c.linkPrecedence === 'primary')
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];

        if (!primaryContact) {
            primaryContact = allContacts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
        }

        const existingEmails = allContacts.map(c => c.email).filter(e => e !== null);
        const existingPhones = allContacts.map(c => c.phoneNumber).filter(p => p !== null);

        const emailsSet = new Set(existingEmails);
        const phonesSet = new Set(existingPhones);

        if ((email && !emailsSet.has(email)) || (phoneNumber && !phonesSet.has(phoneNumber))) {
            await db.execute(
                `INSERT INTO contacts (phoneNumber, email, linkedId, linkPrecedence, createdAt, updatedAt, deletedAt) 
                 VALUES (?, ?, ?, 'secondary', NOW(), NOW(), NULL)`,
                [phoneNumber, email, primaryContact.id]
            );
        }

        const uniquePrimaries = [...new Set(allContacts.filter(c => c.linkPrecedence === 'primary').map(c => c.id))];

        if (uniquePrimaries.length > 1) {
            const oldestPrimaryId = Math.min(...uniquePrimaries);

            for (const id of uniquePrimaries) {
                if (id !== oldestPrimaryId) {
                    await db.execute(
                        `UPDATE contacts SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = NOW() WHERE id = ?`,
                        [oldestPrimaryId, id]
                    );
                }
            }

            await db.execute(
                `UPDATE contacts SET linkedId = ?, updatedAt = NOW() WHERE linkedId IN (${uniquePrimaries.filter(id => id !== oldestPrimaryId).join(",")})`,
                [oldestPrimaryId]
            );

            primaryContact.id = oldestPrimaryId;
        }

        const [finalContacts] = await db.execute(
            `SELECT * FROM contacts WHERE id = ? OR linkedId = ?`,
            [primaryContact.id, primaryContact.id]
        );

        const finalEmails = [...new Set(finalContacts.map(c => c.email).filter(e => e !== null))];
        const finalPhones = [...new Set(finalContacts.map(c => c.phoneNumber).filter(p => p !== null))];
        const secondaryIds = finalContacts.filter(c => c.linkPrecedence === 'secondary').map(c => c.id);

        return res.status(200).json({
            contact: {
                primaryContactId: primaryContact.id,
                emails: finalEmails,
                phoneNumbers: finalPhones,
                secondaryContactIds: secondaryIds
            }
        });

    } catch (error) {
        console.error("Error in identity reconciliation:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
