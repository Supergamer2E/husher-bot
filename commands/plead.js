// plead.js
import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, EmbedBuilder } from 'discord.js';
import { getRecentOffenses } from '../utils/offenseLogger.js';

export default async function handlePlead(interaction) {
  const userId = interaction.user.id;
  const member = await interaction.guild.members.fetch(userId);

  // Check if user is currently in timeout role
  const timeoutRole = interaction.guild.roles.cache.find(r => r.name === 'In Timeout');
  if (!timeoutRole || !member.roles.cache.has(timeoutRole.id)) {
    await interaction.reply({ content: '❌ You are not currently in timeout.', ephemeral: true });
    return;
  }

  // Prevent duplicate court sessions
  if (global.courtActive) {
    await interaction.reply({ content: '⚖️ Court is already in session.', ephemeral: true });
    return;
  }

  // Load the last 3 offenses
  const recentOffenses = getRecentOffenses(userId, 3);
  if (recentOffenses.length === 0) {
    await interaction.reply({ content: '❌ You have no offenses to plead.', ephemeral: true });
    return;
  }

  // Build select menu options from offense history
  const menu = new StringSelectMenuBuilder()
    .setCustomId('select_offense')
    .setPlaceholder('Select the offense you are pleading against')
    .addOptions(recentOffenses.map((offense, index) => new StringSelectMenuOptionBuilder()
      .setLabel(`Offense ${index + 1} - ${new Date(offense.timestamp).toLocaleString()}`)
      .setDescription(offense.reason || 'No reason provided')
      .setValue(index.toString())));

  const row = new ActionRowBuilder().addComponents(menu);

  await interaction.reply({ content: '🧑‍⚖️ Choose which offense you are pleading against:', components: [row], ephemeral: true });

  const collector = interaction.channel.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 30000,
    max: 1
  });

  collector.on('collect', async i => {
    if (i.user.id !== userId) {
      await i.reply({ content: 'This selection is not for you.', ephemeral: true });
      return;
    }

    const selectedIndex = parseInt(i.values[0]);
    const selectedOffense = recentOffenses[selectedIndex];

    global.courtActive = true;
    global.courtData = {
      pleaderId: userId,
      correctorId: selectedOffense.correctorId || null,
      offenseInfo: selectedOffense,
      votes: {},
      participants: new Set(),
      presenceConfirmations: new Set(),
      pausedTimeouts: new Map(),
      courtTimer: null,
      courtChannel: interaction.channel // assuming this is #court
    };

    await i.reply({ content: '📨 Your plea has been recorded. Court will begin shortly.', ephemeral: true });

    // Court announcement handled in separate logic (likely in index.js or a helper)
  });
}
