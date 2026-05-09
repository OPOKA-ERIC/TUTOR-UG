const functions = require('firebase-functions');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');

admin.initializeApp();

const anthropic = new Anthropic({
  apiKey: functions.config().anthropic.key
});

exports.sendChatMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { sessionId, message, userProfile, districtContext } = data;

  try {
    const sessionDoc = await admin.firestore().collection('chatSessions').doc(sessionId).get();
    const session = sessionDoc.data();
    
    const conversationHistory = session.messages || [];
    
    const systemPrompt = buildSystemPrompt(userProfile, districtContext);
    
    const messages = conversationHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
    
    messages.push({ role: 'user', content: message });
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages
    });

    const aiResponse = response.content[0].text;

    return { response: aiResponse };
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get AI response');
  }
});

exports.processDocument = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { documentId, storageURL, fileName } = data;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'You are an expert educational content analyzer. Break down the provided document into 3-5 logical learning sections. Return a JSON array with sections containing: title, content, and a brief summary.',
      messages: [{
        role: 'user',
        content: `Analyze this educational document and break it into learning sections. Document: ${fileName}`
      }]
    });

    const sections = [
      { title: 'Introduction', content: 'Section content here', quizPassed: false, score: 0 },
      { title: 'Key Concepts', content: 'Section content here', quizPassed: false, score: 0 },
      { title: 'Examples', content: 'Section content here', quizPassed: false, score: 0 }
    ];

    await admin.firestore().collection('documents').doc(documentId).update({
      sections: sections,
      status: 'ready'
    });

    return { success: true, sections: sections };
  } catch (error) {
    console.error('Error processing document:', error);
    throw new functions.https.HttpsError('internal', 'Failed to process document');
  }
});

exports.generateQuiz = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { sectionContent, userProfile, districtContext } = data;

  try {
    const systemPrompt = buildSystemPrompt(userProfile, districtContext);
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt + '\n\nGenerate 3-5 multiple choice quiz questions based on the section content. Use local Ugandan context in questions. Return JSON array with: question, options (array of 4), correctIndex, explanation.',
      messages: [{
        role: 'user',
        content: `Generate quiz questions for this section:\n\n${sectionContent}`
      }]
    });

    const questions = [
      {
        question: "Sample question using local context?",
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctIndex: 1,
        explanation: "Explanation here"
      }
    ];

    return { questions: questions };
  } catch (error) {
    console.error('Error generating quiz:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate quiz');
  }
});

function buildSystemPrompt(userProfile, districtContext) {
  return `You are TutorUG, an AI tutor for Ugandan students. You are helping ${userProfile.name}, a ${userProfile.educationLevel} student from ${userProfile.district} district${userProfile.school ? ' at ' + userProfile.school : ''}.

CRITICAL LOCALIZATION RULES:
- Use ONLY Ugandan context in ALL examples, word problems, and explanations
- Reference real places, landmarks, and locations from ${userProfile.district}
- Use local Ugandan names from the district
- Use UGX (Uganda Shillings) for all money examples
- Reference local foods, animals, economy, and daily life from the region
- Make every concept feel familiar and relatable to a student living in ${userProfile.district}

${districtContext}

CURRICULUM LEVEL: ${userProfile.educationLevel}
- Tailor complexity and vocabulary to this education level
- Follow UNEB curriculum standards
- For P7, S4, and S6 students, include exam preparation focus

Teaching Style:
- Clear, patient, encouraging
- Break complex topics into simple steps
- Use analogies from Ugandan daily life
- Ask checking questions to ensure understanding
- Celebrate progress and effort

Always respond in a warm, supportive tone as if you are a caring Ugandan teacher who knows the student's world intimately.`;
}
