import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))

text_line = ("//html2pdf4doc-text-line")
text_group = ("//html2pdf4doc-text-group")
lines_1_2 = '//html2pdf4doc-text-group[@data-child="0"]'
lines_3 = '//tt[@data-child="1"]'
lines_4 = '//tt[@data-child="2"]'
lines_5 = '//tt[@data-child="3"]'
lines_6 = '//tt[@data-child="4"]'
lines_7 = '//tt[@data-child="5"]'
lines_8 = '//tt[@data-child="6"]'
lines_9 = '//tt[@data-child="7"]'
lines_10_11 = '//html2pdf4doc-text-group[@data-child="8"]'

# On Windows / MacOS / Linux, different fonts and text are split differently.
# Therefore, here we only check the case with a standalone inline wrapper `<tt>`.
# We are checking the structure here when `inline_parent`(wrapped in group_wrapper),
# is included in `complex-text-block`,
# and in turn contains text in service wrappers `text-node` and `text-line`.
parent = '/div[@data-testid="test-block"]'
ctb = '/html2pdf4doc-complex-text-block'
# and each line is wrapped into a group
group_wrapper = '/html2pdf4doc-text-group[@data-child]'
inline_parent_part = '/tt'
inner_service_blocks = '/html2pdf4doc-text-node/html2pdf4doc-text-line'
tester = parent + ctb + group_wrapper + inline_parent_part + inner_service_blocks

class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    def test_001(self):
        self.helper.open_case(path_to_this_test_file_folder, '001')
        self.helper.assert_html2pdf4doc_success()
        self.helper.assert_document_has_pages(2)
        # 1 ----------------------------------
        self.helper.assert_element_on_the_page(tester, 1)
