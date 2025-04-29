// commands/plead.js

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';

export default async function(interaction, { userTimeouts, activeTimers, loadCustomComebacks, getTimeoutDuration, formatTime }) {
    if (global.courtActive) {
        await interaction.reply({ content: '⚖️ Court is already in session. Please wait for the current case to finish.', ephemeral: true });
        return;
    }

    const pleader = interaction.user;
    const guild = interaction.guild;
    const courtChannel = interaction.channel;

    // Check if user is actually in timeout
    const member = await guild.members.fetch(pleader.id);
    if (!member.communicationDisabledUntilTimestamp || member.communicationDisabledUntilTimestamp < Date.now()) {
        await interaction.reply({ content: '❌ You are not currently in timeout. You cannot plead.', ephemeral: true });
        return;
    }

    // Get last 3 offenses
    const offenseChoices = [];
    const offenseData = userTimeouts[pleader.id]?.offenses || [];

    const last3 = offenseData.slice(-3);
    if (last3.length === 0) {
        await interaction.reply({ content: '❌ No offenses found to plead about.', ephemeral: true });
        return;
    }

    last3.forEach((offense, idx) => {
        offenseChoices.push({
            label: `Offense #${offenseData.length - last3.length + idx + 1}: ${offense.reason.substring(0, 50)}`,
            description: 'Select this offense to plead against.',
            value: (offenseData.length - last3.length + idx).toString()
        });
    });

    const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('plead_select')
            .setPlaceholder('Select the offense you are pleading about')
            .addOptions(offenseChoices)
    );

    await interaction.reply({ content: '⚖️ Select the offense you want to plead against:', components: [selectMenu], ephemeral: true });

    const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === pleader.id && i.customId === 'plead_select',
        time: 60000
    });

    collector.on('collect', async i => {
        const selectedIndex = parseInt(i.values[0]);
        const selectedOffense = offenseData[selectedIndex];

        if (!selectedOffense) {
            await i.update({ content: '❌ Invalid offense selection.', components: [], ephemeral: true });
            return;
        }

        // Clear the court channel
        const messages = await courtChannel.messages.fetch({ limit: 100 });
        courtChannel.bulkDelete(messages, true).catch(() => {});

        // Start the court case
        global.courtActive = true;
        global.courtData = {
            pleaderId: pleader.id,
            correctorId: selectedOffense.correctorId,
            offenseInfo: selectedOffense,
            votes: {},
            participants: new Set(),
            presenceConfirmations: new Set(),
            pausedTimeouts: new Map(),
            courtTimer: null,
            courtChannel: courtChannel
        };

        // Gather participants (all non-bots)
        const members = await guild.members.fetch();
        members.forEach(m => {
            if (!m.user.bot) {
                global.courtData.participants.add(m.id);
            }
        });

        // Pause all timeouts
        global.courtData.participants.forEach(async pid => {
            const m = await guild.members.fetch(pid);
            if (m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now()) {
                const remaining = m.communicationDisabledUntilTimestamp - Date.now();
                global.courtData.pausedTimeouts.set(pid, remaining);
                try { await m.timeout(null); } catch {}
            }
        });

        // Court summons
        await courtChannel.send(`📣 @everyone Court is commencing!\n**Pleader:** <@${pleader.id}>\n**Reason:** \`${selectedOffense.reason}\`\nPlease confirm your presence.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('present')
                .setLabel('I am Present')
                .setStyle(ButtonStyle.Success)
        );

        await courtChannel.send({ content: '✅ Click below to confirm you are present for court.', components: [row] });

        i.update({ content: '✅ You have pleaded. Waiting for all participants to confirm presence...', components: [] });

        // Collector for presence
        const presenceCollector = courtChannel.createMessageComponentCollector({
            filter: x => x.customId === 'present',
            time: 5 * 60 * 1000 // 5 minutes max to confirm
        });

        presenceCollector.on('collect', async btn => {
            global.courtData.presenceConfirmations.add(btn.user.id);
            await btn.reply({ content: '🧾 Your presence has been confirmed.', ephemeral: true });

            if (global.courtData.presenceConfirmations.size >= global.courtData.participants.size) {
                presenceCollector.stop('all_present');
            }
        });

        presenceCollector.on('end', async (_, reason) => {
            if (reason !== 'all_present') {
                courtChannel.send('⚠️ Not all participants confirmed in time. Court session cancelled.');
                global.courtActive = false;
                global.courtData = null;
                return;
            }

            courtChannel.send('⏳ Everyone is present! Starting 2-minute court discussion timer...');

            // Start 2-minute court timer
            let timeLeft = 120;
            const timerMsg = await courtChannel.send(`🕒 Court discussion time remaining: ${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}`);

            const interval = setInterval(async () => {
                timeLeft--;
                if (timeLeft > 0) {
                    await timerMsg.edit(`🕒 Court discussion time remaining: ${Math.floor(timeLeft/60)}:${(timeLeft%60).toString().padStart(2,'0')}`);
                } else {
                    clearInterval(interval);
                    global.courtData.courtTimer = null;
                    startVoting(courtChannel, pleader);
                }
            }, 1000);

            global.courtData.courtTimer = interval;
        });
    });
}
