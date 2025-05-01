// File: commands/plead.js
import { getRecentOffenses } from '../helpers/offenseLogger.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

export default async function(interaction) {
  if (!interaction.channel || interaction.channel.name !== 'court') {
    return interaction.reply({ content: '⚖️ You can only plead in the #court channel.', ephemeral: true });
  }

  const userId = interaction.user.id;
  const recentOffenses = getRecentOffenses(userId, 3);

  if (recentOffenses.length === 0) {
    return interaction.reply({ content: '❌ You have no offenses to plead.', ephemeral: true });
  }

  if (global.courtActive) {
    return interaction.reply({ content: '⚠️ A court session is already active.', ephemeral: true });
  }

  // Build dropdown menu
  const options = recentOffenses.map((entry, index) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(`Offense ${index + 1}`)
      .setValue(`${index}`)
      .setDescription(entry.reason.length > 50 ? entry.reason.slice(0, 47) + '...' : entry.reason)
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId('plead_offense_select')
    .setPlaceholder('Select the offense to plead against')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(menu);
  await interaction.reply({ content: '🧑‍⚖️ Select the offense you want to plead against:', components: [row], ephemeral: true });

  const collector = interaction.channel.createMessageComponentCollector({
    time: 60000,
    filter: i => i.user.id === userId && i.customId === 'plead_offense_select'
  });

  collector.on('collect', async i => {
    const index = parseInt(i.values[0]);
    const selectedOffense = recentOffenses[index];

    global.courtActive = true;
    global.courtData = {
      active: true,
      pleaderId: userId,
      correctorId: selectedOffense.correctorId,
      offenseInfo: selectedOffense,
      votes: {},
      participants: new Set(),
      presenceConfirmations: new Set(),
      pausedTimeouts: new Map(),
      courtTimer: null,
      courtChannel: interaction.channel
    };

    const members = await interaction.guild.members.fetch();
    for (const [, member] of members) {
      if (!member.user.bot) global.courtData.participants.add(member.id);
    }

    await interaction.channel.send(`📢 Attention @everyone! Court will begin shortly. The pleader <@${userId}> is pleading not guilty to: "${selectedOffense.reason}".`);

    for (const id of global.courtData.participants) {
      try {
        const member = await interaction.guild.members.fetch(id);
        const dm = await member.createDM();
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`present_${id}`).setLabel('I am present').setStyle(ButtonStyle.Success)
        );
        await dm.send({ content: '⚖️ Please confirm your presence for the upcoming court session.', components: [confirmRow] });
      } catch (e) {
        console.warn(`⚠️ Could not DM ${id}.`);
      }
    }

    const presenceCollector = interaction.client.on('interactionCreate', async confirmation => {
      if (!confirmation.isButton()) return;
      if (!confirmation.customId.startsWith('present_')) return;

      const voterId = confirmation.user.id;
      if (!global.courtData || !global.courtData.participants.has(voterId)) return;

      global.courtData.presenceConfirmations.add(voterId);
      await confirmation.reply({ content: '✅ Your presence has been recorded.', ephemeral: true });

      if (global.courtData.presenceConfirmations.size === global.courtData.participants.size) {
        await interaction.channel.send('✅ All members have confirmed presence. Court will now begin.');
        // You would call courtTimerStart() here.
      }
    });
  });
}
